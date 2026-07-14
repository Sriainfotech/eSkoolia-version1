from django.conf import settings
from django.core.mail import send_mail
from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.core.models import AcademicYear

from .models import (
    CommunicationNotification,
    CommunicationPreference,
    EmailMessageLog,
    EmailSmsLog,
    HolidayCalendar,
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
    action_permission_codes = {}

    def check_permissions(self, request):
        super().check_permissions(request)

        if not request.user or not request.user.is_authenticated:
            return

        if request.user.is_superuser:
            return

        action = getattr(self, "action", None)
        permission_code = self.action_permission_codes.get(action, self.required_permission_code)

        if not hasattr(request.user, "has_permission_code") or not request.user.has_permission_code(permission_code):
            raise ValidationError("You do not have permission to access communication features.")


class BaseCommunicationViewSet(CommunicationPermissionMixin, viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]


class CommunicationPreferenceViewSet(BaseCommunicationViewSet):
    serializer_class = CommunicationPreferenceSerializer
    http_method_names = ["get", "post", "patch", "put", "head", "options"]

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
        "mark_read": "utilities.communication.view",
        "mark_all_read": "utilities.communication.view",
    }
    filterset_fields = ["notification_type", "is_read"]
    search_fields = ["title", "body"]
    ordering_fields = ["created_at", "read_at"]

    def get_queryset(self):
        user = self.request.user
        queryset = CommunicationNotification.objects.select_related("recipient", "created_by")
        if user.is_superuser:
            return queryset
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
        if user.is_superuser:
            return queryset
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
        if user.is_superuser:
            return queryset
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
    serializer_class = HolidayCalendarSerializer

    def get_queryset(self):
        queryset = HolidayCalendar.objects.select_related("created_by", "updated_by", "school", "academic_year")
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
