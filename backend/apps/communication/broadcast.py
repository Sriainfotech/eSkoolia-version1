"""Audience resolution + delivery for BroadcastMessage.

Kept separate from views.py/tasks.py so both the synchronous (immediate
send) and Celery (scheduled send) paths call the exact same logic.
"""

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.db.models import Q
from django.utils import timezone

from .models import BroadcastMessage, CommunicationNotification, EmailMessageLog, EmailSmsLog


def resolve_recipient_user_ids(school, audience_type, class_ids):
    """Returns a set of User IDs for the given audience — always school-scoped."""
    from apps.students.models import Student
    from apps.hr.models import Staff

    if audience_type == BroadcastMessage.AUDIENCE_ALL_PARENTS:
        qs = Student.objects.filter(school=school, status="active", guardian__user__isnull=False)
        return set(qs.values_list("guardian__user_id", flat=True))

    if audience_type == BroadcastMessage.AUDIENCE_CLASS_PARENTS:
        if not class_ids:
            return set()
        qs = Student.objects.filter(
            school=school, status="active", current_class_id__in=class_ids, guardian__user__isnull=False
        )
        return set(qs.values_list("guardian__user_id", flat=True))

    if audience_type == BroadcastMessage.AUDIENCE_TEACHERS:
        qs = Staff.objects.filter(school=school, status="active", user__isnull=False).filter(
            Q(designation__role_template__icontains="teacher") | Q(role__name__icontains="teacher")
        )
        return set(qs.values_list("user_id", flat=True))

    if audience_type == BroadcastMessage.AUDIENCE_ALL_STAFF:
        qs = Staff.objects.filter(school=school, status="active", user__isnull=False)
        return set(qs.values_list("user_id", flat=True))

    return set()


def teacher_assigned_class_ids(user):
    """Class IDs (core.Class) where `user` is the active class teacher."""
    from apps.academics.models import ClassTeacherAssignment

    return list(
        ClassTeacherAssignment.objects.filter(teacher=user, active_status=True)
        .values_list("school_class_id", flat=True)
        .distinct()
    )


TEMPLATE_TITLES = {
    "bus_delay": "Bus delay notice",
    "closure": "School closure notice",
    "exam_remind": "Exam reminder",
    "event": "Event notice",
    "fee_due": "Fee due reminder",
    "custom": "School announcement",
}


def dispatch_broadcast(broadcast_id):
    """Resolve recipients and actually deliver. Safe to call for both an
    immediate send and a scheduled one (Celery task calls this)."""
    try:
        broadcast = BroadcastMessage.objects.select_related("school", "created_by").get(pk=broadcast_id)
    except BroadcastMessage.DoesNotExist:
        return

    try:
        user_ids = resolve_recipient_user_ids(broadcast.school, broadcast.audience_type, broadcast.audience_class_ids)

        title = TEMPLATE_TITLES.get(broadcast.template, "School announcement")

        User = get_user_model()
        recipients = list(User.objects.filter(id__in=user_ids))

        notifications = [
            CommunicationNotification(
                school=broadcast.school,
                recipient=user,
                created_by=broadcast.created_by,
                title=title,
                body=broadcast.message,
                notification_type=CommunicationNotification.TYPE_ANNOUNCEMENT,
            )
            for user in recipients
        ]
        CommunicationNotification.objects.bulk_create(notifications)

        if "email" in broadcast.channels:
            from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None) or getattr(settings, "EMAIL_HOST_USER", "")
            for user in recipients:
                if not user.email:
                    continue
                log = EmailMessageLog.objects.create(
                    school=broadcast.school,
                    created_by=broadcast.created_by,
                    recipient=user,
                    to_email=user.email,
                    subject=title,
                    body=broadcast.message,
                    status=EmailMessageLog.STATUS_QUEUED,
                )
                try:
                    send_mail(subject=title, message=broadcast.message, from_email=from_email,
                               recipient_list=[user.email], fail_silently=False)
                    log.status = EmailMessageLog.STATUS_SENT
                    log.sent_at = timezone.now()
                except Exception as exc:
                    log.status = EmailMessageLog.STATUS_FAILED
                    log.error_message = str(exc)[:500]
                log.save()

        if "sms" in broadcast.channels:
            # No SMS provider is wired up for general broadcast — log intent
            # only, don't claim delivery. (apps.admissions has its own
            # Twilio adapter, scoped to admissions follow-ups only.)
            for user in recipients:
                EmailSmsLog.objects.create(
                    school=broadcast.school,
                    created_by=broadcast.created_by,
                    title=title,
                    description=broadcast.message,
                    send_through="S",
                    send_to=EmailSmsLog.SEND_TO_INDIVIDUAL,
                    send_date=timezone.now().date(),
                    target_data={"user_id": user.id, "phone": getattr(user, "phone", "") or ""},
                )

        broadcast.status = BroadcastMessage.STATUS_SENT
        broadcast.sent_at = timezone.now()
        broadcast.recipient_count = len(user_ids)
        broadcast.save(update_fields=["status", "sent_at", "recipient_count"])
    except Exception as exc:
        broadcast.status = BroadcastMessage.STATUS_FAILED
        broadcast.error = str(exc)[:2000]
        broadcast.save(update_fields=["status", "error"])
        raise
