from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.models import AcademicYear, Holiday

from .models import (
    BroadcastMessage,
    CommunicationNotification,
    CommunicationPreference,
    EmailMessageLog,
    EmailSmsLog,
    InAppMessage,
    NoticeBoard,
)
from .serializers import (
    CommunicationNotificationSerializer,
    CommunicationPreferenceSerializer,
    EmailMessageLogSerializer,
    EmailSmsLogSerializer,
    HolidayCalendarSerializer,
    InAppMessageSerializer,
    NoticeBoardSerializer,
)


class CommunicationPermissionMixin:
    required_permission_code = "utilities.communication.view"
    # Map action name -> permission code. A value of None means "no permission
    # code required" — use this only for actions that are inherently
    # self-scoped (e.g. get_queryset() already filters to request.user), where
    # gating behind an admin-grantable permission would just be an extra
    # barrier to a user seeing their own data, never a real access control.
    action_permission_codes = {}

    def check_permissions(self, request):
        super().check_permissions(request)

        if not request.user or not request.user.is_authenticated:
            return

        if request.user.is_superuser:
            return

        action = getattr(self, "action", None)
        if action in self.action_permission_codes:
            permission_code = self.action_permission_codes[action]
            if permission_code is None:
                return
        else:
            permission_code = self.required_permission_code

        if not hasattr(request.user, "has_permission_code") or not request.user.has_permission_code(permission_code):
            raise ValidationError("You do not have permission to access communication features.")


class BaseCommunicationViewSet(CommunicationPermissionMixin, viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]


class CommunicationPreferenceViewSet(BaseCommunicationViewSet):
    serializer_class = CommunicationPreferenceSerializer
    http_method_names = ["get", "post", "patch", "put", "head", "options"]
    action_permission_codes = {
        # list/create below are hardcoded to request.user's own row
        # (get_or_create(user=request.user)) — can never touch another
        # user's preferences, so no permission code is needed.
        "list": None,
        "create": None,
    }

    def get_queryset(self):
        return CommunicationPreference.objects.filter(user=self.request.user)

    def list(self, request, *args, **kwargs):
        obj, _ = CommunicationPreference.objects.get_or_create(
            user=request.user,
            defaults={"school": request.user.school},
        )
        serializer = self.get_serializer(obj)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        obj, _ = CommunicationPreference.objects.get_or_create(
            user=request.user,
            defaults={"school": request.user.school},
        )
        serializer = self.get_serializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class CommunicationNotificationViewSet(BaseCommunicationViewSet):
    serializer_class = CommunicationNotificationSerializer
    action_permission_codes = {
        # Reading and managing YOUR OWN notification inbox is basic account
        # functionality, not an admin-configurable "communication module"
        # feature — get_queryset() below always scopes to recipient=user, so
        # these can never expose anyone else's data. Only `create` (pushing a
        # notification TO another user) stays behind the real permission.
        "list": None,
        "retrieve": None,
        "mark_read": None,
        "mark_all_read": None,
    }
    filterset_fields = ["notification_type", "is_read"]
    search_fields = ["title", "body"]
    ordering_fields = ["created_at", "read_at"]

    def get_queryset(self):
        user = self.request.user
        queryset = CommunicationNotification.objects.select_related("recipient", "created_by")
        # Personal notifications — always scoped to the requesting user, even
        # for superusers (see CLAUDE.md tenancy policy: no is_superuser bypass
        # on ordinary per-user/per-school data views).
        return queryset.filter(recipient=user)

    def perform_create(self, serializer):
        recipient = serializer.validated_data["recipient"]
        preference, _ = CommunicationPreference.objects.get_or_create(
            user=recipient,
            defaults={"school": recipient.school},
        )

        if preference.mute_all or not preference.allow_notifications:
            raise ValidationError("Recipient has disabled notifications.")

        serializer.save(created_by=self.request.user, school=self.request.user.school)

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        if not notification.is_read:
            notification.is_read = True
            notification.read_at = timezone.now()
            notification.save(update_fields=["is_read", "read_at", "updated_at"])
        return Response({"status": "success", "message": "Notification marked as read."})

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        updated = self.get_queryset().filter(is_read=False).update(is_read=True, read_at=timezone.now())
        return Response({"status": "success", "updated": updated})


class InAppMessageViewSet(BaseCommunicationViewSet):
    serializer_class = InAppMessageSerializer
    action_permission_codes = {
        "mark_read": "utilities.communication.view",
    }
    filterset_fields = ["category", "is_read", "sender", "recipient"]
    search_fields = ["subject", "body"]
    ordering_fields = ["created_at", "read_at"]

    def get_queryset(self):
        user = self.request.user
        queryset = InAppMessage.objects.select_related("sender", "recipient")
        # Personal messages — always scoped to sender/recipient, even for
        # superusers (see CLAUDE.md tenancy policy).
        return queryset.filter(Q(sender=user) | Q(recipient=user))

    def perform_create(self, serializer):
        recipient = serializer.validated_data["recipient"]
        preference, _ = CommunicationPreference.objects.get_or_create(
            user=recipient,
            defaults={"school": recipient.school},
        )

        if preference.mute_all or not preference.allow_in_app:
            raise ValidationError("Recipient has disabled in-app messages.")

        serializer.save(
            sender=self.request.user,
            school=self.request.user.school,
            delivered_at=timezone.now(),
        )

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        message = self.get_object()
        if message.recipient_id != request.user.id and not request.user.is_superuser:
            raise ValidationError("Only the recipient can mark this message as read.")

        if not message.is_read:
            message.is_read = True
            message.read_at = timezone.now()
            message.save(update_fields=["is_read", "read_at", "updated_at"])
        return Response({"status": "success", "message": "Message marked as read."})


class EmailMessageLogViewSet(BaseCommunicationViewSet):
    serializer_class = EmailMessageLogSerializer
    filterset_fields = ["status", "recipient"]
    search_fields = ["to_email", "subject", "body"]
    ordering_fields = ["created_at", "sent_at"]

    def get_queryset(self):
        user = self.request.user
        queryset = EmailMessageLog.objects.select_related("recipient", "created_by")
        # Scoped to sender/recipient, even for superusers (CLAUDE.md tenancy policy).
        return queryset.filter(Q(created_by=user) | Q(recipient=user))

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        recipient = serializer.validated_data.get("recipient")
        to_email = serializer.validated_data["to_email"]

        log = EmailMessageLog.objects.create(
            school=request.user.school,
            recipient=recipient,
            created_by=request.user,
            to_email=to_email,
            subject=serializer.validated_data["subject"],
            body=serializer.validated_data["body"],
            metadata=serializer.validated_data.get("metadata") or {},
            status=EmailMessageLog.STATUS_QUEUED,
        )

        if recipient:
            preference, _ = CommunicationPreference.objects.get_or_create(
                user=recipient,
                defaults={"school": recipient.school},
            )
            if preference.mute_all or not preference.allow_email:
                log.status = EmailMessageLog.STATUS_SKIPPED
                log.error_message = "Recipient has disabled email communication."
                log.save(update_fields=["status", "error_message", "updated_at"])
                output = self.get_serializer(log)
                return Response(output.data, status=status.HTTP_201_CREATED)

        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@example.com")
        try:
            send_mail(
                subject=log.subject,
                message=log.body,
                from_email=from_email,
                recipient_list=[log.to_email],
                fail_silently=False,
            )
            log.status = EmailMessageLog.STATUS_SENT
            log.sent_at = timezone.now()
            log.error_message = ""
            log.save(update_fields=["status", "sent_at", "error_message", "updated_at"])
        except Exception as ex:
            log.status = EmailMessageLog.STATUS_FAILED
            log.error_message = str(ex)
            log.save(update_fields=["status", "error_message", "updated_at"])

        output = self.get_serializer(log)
        return Response(output.data, status=status.HTTP_201_CREATED)


class EmailSmsLogViewSet(BaseCommunicationViewSet):
    serializer_class = EmailSmsLogSerializer

    def get_queryset(self):
        queryset = EmailSmsLog.objects.select_related("created_by", "school", "academic_year")
        return queryset.filter(Q(school=self.request.user.school) | Q(school__isnull=True))

    def perform_create(self, serializer):
        academic_year = AcademicYear.objects.filter(school=self.request.user.school, is_current=True).first()
        serializer.save(
            created_by=self.request.user,
            school=self.request.user.school,
            academic_year=academic_year,
        )


class NoticeBoardViewSet(BaseCommunicationViewSet):
    serializer_class = NoticeBoardSerializer
    filter_backends = []

    def get_queryset(self):
        queryset = NoticeBoard.objects.select_related("created_by", "updated_by", "school", "academic_year")
        return queryset.filter(Q(school=self.request.user.school) | Q(school__isnull=True))

    def perform_create(self, serializer):
        academic_year = AcademicYear.objects.filter(school=self.request.user.school, is_current=True).first()
        serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user,
            school=self.request.user.school,
            academic_year=academic_year,
        )

    def perform_update(self, serializer):
        academic_year = AcademicYear.objects.filter(school=self.request.user.school, is_current=True).first()
        serializer.save(
            updated_by=self.request.user,
            school=self.request.user.school,
            academic_year=academic_year,
        )


class HolidayCalendarViewSet(BaseCommunicationViewSet):
    """Reads/writes core.Holiday — the same table Academics > Foundation and
    Settings > Holiday Calendar use — so a holiday created from any of the
    three surfaces shows up in the other two, plus exam scheduling and the
    parent portal, which also read core.Holiday."""

    serializer_class = HolidayCalendarSerializer

    def get_queryset(self):
        queryset = Holiday.objects.select_related("school", "academic_year")
        return queryset.filter(Q(school=self.request.user.school) | Q(school__isnull=True))

    def perform_create(self, serializer):
        academic_year = AcademicYear.objects.filter(school=self.request.user.school, is_current=True).first()
        serializer.save(
            school=self.request.user.school,
            academic_year=academic_year,
        )

    def perform_update(self, serializer):
        academic_year = AcademicYear.objects.filter(school=self.request.user.school, is_current=True).first()
        serializer.save(
            school=self.request.user.school,
            academic_year=academic_year,
        )


class BroadcastAudienceOptionsView(APIView):
    """Tells the frontend which audience types + classes this user may
    target. Teachers only ever see their own class-teacher class(es)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.communication.broadcast import teacher_assigned_class_ids
        from apps.core.models import Class

        user = request.user
        school = user.school
        if not school:
            return Response({"is_teacher": False, "audience_types": [], "classes": []})

        is_teacher = user.resolve_portal_type() == "teacher" if hasattr(user, "resolve_portal_type") else False

        if is_teacher:
            class_ids = teacher_assigned_class_ids(user)
            classes = list(Class.objects.filter(id__in=class_ids, school_id=school.id).values("id", "name"))
            return Response({
                "is_teacher": True,
                "audience_types": [BroadcastMessage.AUDIENCE_CLASS_PARENTS],
                "classes": classes,
            })

        classes = list(
            Class.objects.filter(school_id=school.id, is_active=True)
            .values("id", "name")
            .order_by("numeric_order", "name")
        )
        return Response({
            "is_teacher": False,
            "audience_types": [
                BroadcastMessage.AUDIENCE_ALL_PARENTS,
                BroadcastMessage.AUDIENCE_CLASS_PARENTS,
                BroadcastMessage.AUDIENCE_TEACHERS,
                BroadcastMessage.AUDIENCE_ALL_STAFF,
            ],
            "classes": classes,
        })


class BroadcastMessageView(APIView):
    """GET: history of broadcasts — whoever composed one can always see their
    own; a school admin/superuser sees every broadcast for the school (same
    "no is_superuser bypass on ordinary scoping" policy as elsewhere, but
    admin oversight of what's been sent to the whole school is the actual
    intended capability here, not a bypass of it).

    POST: resolve the audience, create the BroadcastMessage, and either
    dispatch immediately or schedule it via Celery for `scheduled_at`."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .serializers import BroadcastMessageSerializer

        user = request.user
        if not user.school:
            return Response({"error": "No school on this account."}, status=status.HTTP_400_BAD_REQUEST)

        queryset = BroadcastMessage.objects.filter(school=user.school).select_related("created_by")
        if not (user.is_superuser or user.is_school_admin):
            queryset = queryset.filter(created_by=user)

        queryset = queryset.order_by("-created_at")[:50]
        return Response(BroadcastMessageSerializer(queryset, many=True).data)

    def post(self, request):
        from apps.communication.broadcast import dispatch_broadcast, resolve_recipient_user_ids, teacher_assigned_class_ids

        user = request.user
        school = user.school
        if not school:
            return Response({"error": "No school on this account."}, status=status.HTTP_400_BAD_REQUEST)

        message = (request.data.get("message") or "").strip()
        if not message:
            return Response({"error": "Message is required."}, status=status.HTTP_400_BAD_REQUEST)

        template = (request.data.get("template") or "").strip()
        audience_type = request.data.get("audience_type")
        class_ids = request.data.get("class_ids") or []
        channels = [c for c in (request.data.get("channels") or []) if c in {"sms", "push", "email"}]
        scheduled_at_raw = request.data.get("scheduled_at")

        is_teacher = user.resolve_portal_type() == "teacher" if hasattr(user, "resolve_portal_type") else False
        if is_teacher:
            # Server-side enforcement — never trust the client for this.
            # A teacher may only ever broadcast to parents of their own
            # class-teacher class(es).
            allowed_class_ids = set(teacher_assigned_class_ids(user))
            class_ids = [cid for cid in class_ids if cid in allowed_class_ids]
            audience_type = BroadcastMessage.AUDIENCE_CLASS_PARENTS
            if not class_ids:
                return Response(
                    {"error": "You are not assigned as class teacher for any class."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        elif audience_type not in dict(BroadcastMessage.AUDIENCE_CHOICES):
            return Response({"error": "Invalid audience_type."}, status=status.HTTP_400_BAD_REQUEST)

        scheduled_at = None
        if scheduled_at_raw:
            parsed = parse_datetime(scheduled_at_raw)
            if not parsed:
                return Response({"error": "scheduled_at must be an ISO datetime."}, status=status.HTTP_400_BAD_REQUEST)
            if timezone.is_naive(parsed):
                parsed = timezone.make_aware(parsed)
            now = timezone.now()
            if parsed <= now:
                return Response({"error": "scheduled_at must be in the future."}, status=status.HTTP_400_BAD_REQUEST)
            one_year_out = now + timedelta(days=366)
            if parsed > one_year_out:
                return Response(
                    {"error": "scheduled_at must be within 1 year from today."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            scheduled_at = parsed

        recipient_count = len(resolve_recipient_user_ids(school, audience_type, class_ids))

        broadcast = BroadcastMessage.objects.create(
            school=school,
            created_by=user,
            template=template,
            message=message,
            audience_type=audience_type,
            audience_class_ids=class_ids,
            channels=channels,
            scheduled_at=scheduled_at,
            recipient_count=recipient_count,
        )

        if scheduled_at:
            # Scheduling genuinely requires Celery to be installed AND a
            # running worker + broker (same infra apps.admissions already
            # depends on for bulk jobs). If either isn't available, say so
            # honestly instead of pretending the message is scheduled when
            # nothing will ever send it.
            try:
                from apps.communication.tasks import dispatch_broadcast_task
                dispatch_broadcast_task.apply_async(args=[broadcast.id], eta=scheduled_at)
            except Exception:
                broadcast.status = BroadcastMessage.STATUS_FAILED
                broadcast.error = "Could not reach the task queue (Celery/Redis) to schedule this send."
                broadcast.save(update_fields=["status", "error"])
                return Response(
                    {"error": "Scheduling is unavailable right now — the background task queue isn't reachable. Try Send Now instead, or try again once the worker is running."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            return Response({
                "id": broadcast.id,
                "status": "scheduled",
                "scheduled_at": scheduled_at.isoformat(),
                "recipient_count": recipient_count,
                "message": f"Scheduled for {recipient_count} recipient(s) at {scheduled_at.strftime('%d %b, %I:%M %p')}.",
            }, status=status.HTTP_201_CREATED)

        # Immediate send — dispatch synchronously so it works even without a
        # Celery worker running (no reason "Send Now" should depend on infra
        # that a future send needs but an instant one doesn't).
        try:
            dispatch_broadcast(broadcast.id)
        except Exception:
            pass  # dispatch_broadcast already recorded status=failed + error
        broadcast.refresh_from_db()
        if broadcast.status == BroadcastMessage.STATUS_FAILED:
            return Response(
                {"error": broadcast.error or "Broadcast failed to send."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return Response({
            "id": broadcast.id,
            "status": "sent",
            "recipient_count": broadcast.recipient_count,
            "message": f"Sent to {broadcast.recipient_count} recipient(s).",
        }, status=status.HTTP_201_CREATED)
