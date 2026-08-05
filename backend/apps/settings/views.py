import os
from decimal import Decimal

from django.conf import settings as django_settings
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from django.http import HttpResponse

from apps.core.models import Holiday
from apps.hr.models import LeaveType
from apps.tenancy.models import School, SchoolTenant

from .audit import log_settings_action
from .branding import get_header_image_bytes, normalize_image_to_png, rasterize_pdf_first_page
from .carry_forward import compute_carry_forward, run_carry_forward
from .leave_seed import ensure_default_leave_types
from .models import (
    CarryForwardLog,
    DocumentBrandingSettings,
    LeaveBalance,
    SchoolAttendancePolicy,
    SchoolPolicyDocument,
    SchoolSMTPSettings,
    SettingsAuditLog,
    StaffHolidayExclusion,
)
from .serializers import (
    CarryForwardLogSerializer,
    DocumentBrandingSettingsSerializer,
    LeaveBalanceSerializer,
    LeavePolicySerializer,
    SchoolAttendancePolicySerializer,
    SchoolInfoSerializer,
    SchoolPolicyDocumentSerializer,
    SchoolSMTPSettingsSerializer,
    SettingsAuditLogSerializer,
    StaffHolidayExclusionSerializer,
    StaffHolidaySerializer,
)


class SchoolScopedModelViewSet(viewsets.ModelViewSet):
    """Mirrors apps.hr.views.SchoolScopedModelViewSet exactly (permission-code
    gating + unconditional school_id scoping, superusers included) so the
    frontend's usePermissions().can('settings.<slug>') checks work the same
    way they already do for every other module."""

    permission_classes = [permissions.IsAuthenticated]
    permission_codes = {}

    def get_required_permission_code(self):
        action_name = getattr(self, "action", None)
        if action_name and action_name in self.permission_codes:
            return self.permission_codes[action_name]
        return self.permission_codes.get("*")

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        code = self.get_required_permission_code()
        if not code:
            return
        user = request.user
        if user.is_superuser:
            return
        if not hasattr(user, "has_permission_code") or not user.has_permission_code(code):
            raise PermissionDenied("You do not have permission to perform this action.")

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.school_id:
            return queryset.filter(school_id=user.school_id)
        return queryset.none()

    def perform_create(self, serializer):
        user = self.request.user
        school = user.school or getattr(self.request, "school", None)
        if not school and not user.is_superuser:
            raise PermissionDenied("School context is required.")
        serializer.save(school=school)


class SchoolInfoView(generics.RetrieveUpdateAPIView):
    """Settings > School Info. Singleton per school, resolved via
    school.tenant_record (see Phase 0 tenancy join fix)."""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SchoolInfoSerializer

    def get_object(self):
        user = self.request.user
        if not user.is_superuser and not (
            hasattr(user, "has_permission_code") and user.has_permission_code("settings.school_info.view")
        ):
            raise PermissionDenied("You do not have permission to view school info.")
        if not user.school_id:
            raise ValidationError({"school": ["Your account is not linked to a school."]})
        tenant = SchoolTenant.objects.filter(school_id=user.school_id).first()
        if tenant is None:
            raise ValidationError({
                "school": ["No tenant record exists for this school yet. Contact support to provision one."]
            })
        return tenant

    def perform_update(self, serializer):
        instance = serializer.save()
        changes = {k: (str(v) if isinstance(v, Decimal) else v) for k, v in serializer.validated_data.items()}
        # Not a model field — the frontend's map-location picker sends this only when
        # the admin confirmed overwriting City/State/etc. from a pin drop, so the
        # audit trail records *why*, not just what changed.
        reason = str(self.request.data.get("location_update_reason") or "").strip()
        if reason:
            changes["_location_update_reason"] = reason
        log_settings_action(
            self.request, "school_info.update", object_type="SchoolTenant", object_id=instance.pk,
            # SettingsAuditLog.changes is a plain JSONField (no DjangoJSONEncoder), so
            # Decimal values (latitude/longitude) must be stringified or json.dumps
            # inside log_settings_action raises "Object of type Decimal is not JSON serializable".
            changes=changes,
        )


class SchoolInfoLogoUploadView(generics.GenericAPIView):
    """POST a new logo image for Settings > School Info. Stored under
    MEDIA_ROOT/school_logos/<tenant_id>.<ext> — the same location the
    super-admin school-logo upload writes to, so either surface can
    replace what the other uploaded."""

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = SchoolInfoSerializer

    ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png"}
    MAX_FILE_SIZE = 2 * 1024 * 1024  # 2MB

    def post(self, request):
        user = request.user
        if not user.is_superuser and not (
            hasattr(user, "has_permission_code") and user.has_permission_code("settings.school_info.view")
        ):
            raise PermissionDenied("You do not have permission to edit school info.")
        if not user.school_id:
            raise ValidationError({"school": ["Your account is not linked to a school."]})
        tenant = SchoolTenant.objects.filter(school_id=user.school_id).first()
        if tenant is None:
            raise ValidationError({
                "school": ["No tenant record exists for this school yet. Contact support to provision one."]
            })

        uploaded = request.FILES.get("file")
        if uploaded is None:
            raise ValidationError({"file": ["A file is required."]})
        content_type = getattr(uploaded, "content_type", None)
        if content_type not in self.ALLOWED_CONTENT_TYPES:
            raise ValidationError({"file": ["Only JPG or PNG images are allowed."]})
        if uploaded.size > self.MAX_FILE_SIZE:
            raise ValidationError({"file": [f"File exceeds the {self.MAX_FILE_SIZE // (1024 * 1024)}MB limit."]})

        ext = ".png" if content_type == "image/png" else ".jpg"
        upload_dir = os.path.join(django_settings.MEDIA_ROOT, "school_logos")
        os.makedirs(upload_dir, exist_ok=True)
        filename = f"{tenant.tenant_id}{ext}"
        with open(os.path.join(upload_dir, filename), "wb+") as dest:
            for chunk in uploaded.chunks():
                dest.write(chunk)

        tenant.logo_url = f"{django_settings.MEDIA_URL}school_logos/{filename}"
        tenant.save(update_fields=["logo_url"])

        log_settings_action(
            self.request, "school_info.upload_logo", object_type="SchoolTenant", object_id=tenant.pk,
        )
        return Response(self.get_serializer(tenant).data, status=status.HTTP_201_CREATED)


def _require_document_branding_access(user):
    if user.is_superuser:
        return
    if not (hasattr(user, "has_permission_code") and user.has_permission_code("settings.document_branding.view")):
        raise PermissionDenied("You do not have permission to manage document branding.")
    if not user.school_id:
        raise ValidationError({"school": ["Your account is not linked to a school."]})


class DocumentBrandingSettingsView(generics.RetrieveUpdateAPIView):
    """Settings > Document Branding. Singleton per school (get-or-created on
    first access) — mode/style/color and the per-document declaration texts.
    The header image itself is served by DocumentBrandingHeaderImageView,
    and the letterhead file is uploaded via
    DocumentBrandingUploadLetterheadView, not here."""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DocumentBrandingSettingsSerializer

    def get_object(self):
        user = self.request.user
        _require_document_branding_access(user)
        branding, _created = DocumentBrandingSettings.objects.get_or_create(school_id=user.school_id)
        return branding

    def perform_update(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        log_settings_action(
            self.request, "document_branding.update", object_type="DocumentBrandingSettings", object_id=instance.pk,
            changes={k: v for k, v in serializer.validated_data.items()},
        )


class DocumentBrandingUploadLetterheadView(generics.GenericAPIView):
    """POST a PDF or image letterhead. The first page (if PDF) or the image
    itself (re-encoded to PNG) is rasterized once, here, and stored — every
    later request just reads that PNG back rather than re-processing the
    upload each time. Switches header_mode to "uploaded" automatically."""

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    serializer_class = DocumentBrandingSettingsSerializer

    ALLOWED_CONTENT_TYPES = {"application/pdf", "image/jpeg", "image/png"}
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB, matches the existing school-logo upload limit

    def post(self, request):
        _require_document_branding_access(request.user)

        uploaded = request.FILES.get("file")
        if uploaded is None:
            raise ValidationError({"file": ["A file is required."]})
        if uploaded.size > self.MAX_FILE_SIZE:
            raise ValidationError({"file": [f"File exceeds the {self.MAX_FILE_SIZE // (1024*1024)}MB limit."]})
        content_type = getattr(uploaded, "content_type", None)
        if content_type not in self.ALLOWED_CONTENT_TYPES:
            raise ValidationError({"file": ["Only PDF, JPEG, or PNG files are allowed."]})

        raw_bytes = uploaded.read()
        is_pdf = content_type == "application/pdf"
        try:
            if is_pdf:
                rendered_png = rasterize_pdf_first_page(raw_bytes)
            else:
                rendered_png = normalize_image_to_png(raw_bytes)
        except Exception:
            raise ValidationError({"file": ["Could not read this file — it may be corrupted or an unsupported format."]})

        from django.core.files.base import ContentFile

        branding, _created = DocumentBrandingSettings.objects.get_or_create(school_id=request.user.school_id)
        # Reset the file pointer since rasterize/normalize already consumed raw_bytes via .read().
        uploaded.seek(0)
        branding.letterhead_source_file = uploaded
        branding.letterhead_source_file_type = (
            DocumentBrandingSettings.LETTERHEAD_PDF if is_pdf else DocumentBrandingSettings.LETTERHEAD_IMAGE
        )
        branding.letterhead_rendered_image.save(
            f"letterhead_{request.user.school_id}.png", ContentFile(rendered_png), save=False
        )
        branding.header_mode = DocumentBrandingSettings.MODE_UPLOADED
        branding.updated_by = request.user
        branding.save()

        log_settings_action(
            self.request, "document_branding.upload_letterhead",
            object_type="DocumentBrandingSettings", object_id=branding.pk,
        )
        return Response(self.get_serializer(branding).data, status=status.HTTP_201_CREATED)


class DocumentBrandingHeaderImageView(generics.GenericAPIView):
    """GET the saved header image (PNG) for the current user's school."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if not user.school_id:
            raise ValidationError({"school": ["Your account is not linked to a school."]})
        school = get_object_or_404(School, id=user.school_id)
        png_bytes = get_header_image_bytes(school)
        return HttpResponse(png_bytes, content_type="image/png")


class DocumentBrandingPreviewView(generics.GenericAPIView):
    """POST unsaved branding params → PNG preview. Never touches the DB.
    Only the style/layout fields are accepted; school identity (name, logo,
    address) always comes from the authenticated user's own school so there
    is no cross-tenant data exposure surface."""

    permission_classes = [permissions.IsAuthenticated]

    _BOOL_FIELDS = {"show_divider", "show_watermark", "show_logo"}
    _ALLOWED = {
        "header_style", "header_text_color", "accent_color", "header_size",
        "logo_position", "show_divider", "divider_style", "show_watermark", "watermark_text",
        "show_logo",
    }

    def post(self, request):
        _require_document_branding_access(request.user)
        if not request.user.school_id:
            raise ValidationError({"school": ["Your account is not linked to a school."]})

        school = get_object_or_404(School, id=request.user.school_id)
        saved, _ = DocumentBrandingSettings.objects.get_or_create(school_id=request.user.school_id)

        from types import SimpleNamespace
        params = request.data
        attrs = {}
        for attr in self._ALLOWED:
            if attr in params:
                val = params[attr]
                if attr in self._BOOL_FIELDS:
                    val = val in (True, "true", "True", "1", 1)
                attrs[attr] = val
            else:
                attrs[attr] = getattr(saved, attr)
        transient = SimpleNamespace(**attrs)

        from apps.settings.branding import render_generated_header_png
        png_bytes = render_generated_header_png(school, branding_override=transient)
        return HttpResponse(png_bytes, content_type="image/png")


class LeavePolicyViewSet(SchoolScopedModelViewSet):
    """Settings > Leave Policy — full CRUD. This is the primary place a
    school designs its leave policy (create/edit/delete leave types),
    matching Royal HRMS's own Settings-owned flow. Built-in leave types
    (auto-seeded per school, see leave_seed.py) can be edited but not
    deleted, and any leave type already referenced by a LeaveDefine or
    LeaveRequest can't be deleted either — both match the "don't break
    in-use data" rule already established elsewhere in this app."""

    queryset = LeaveType.objects.select_related("school").all()
    serializer_class = LeavePolicySerializer
    permission_codes = {"*": "settings.leave_policy.view"}

    def list(self, request, *args, **kwargs):
        if request.user.school_id:
            ensure_default_leave_types(request.user.school_id)
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        user = self.request.user
        school = user.school or getattr(self.request, "school", None)
        if not school and not user.is_superuser:
            raise PermissionDenied("School context is required.")
        instance = serializer.save(school=school)
        log_settings_action(self.request, "leave_policy.create", object_type="LeaveType", object_id=instance.pk)

    def perform_update(self, serializer):
        instance = serializer.save()
        log_settings_action(
            self.request, "leave_policy.update", object_type="LeaveType", object_id=instance.pk,
            changes=serializer.validated_data,
        )

    def perform_destroy(self, instance):
        if instance.is_builtin:
            raise ValidationError({"non_field_errors": ["Built-in leave types cannot be deleted — deactivate instead."]})
        if instance.leave_defines.exists() or instance.leave_requests.exists():
            raise ValidationError({"non_field_errors": ["This leave type is already in use and cannot be deleted — deactivate instead."]})
        object_id = instance.pk
        super().perform_destroy(instance)
        log_settings_action(self.request, "leave_policy.delete", object_type="LeaveType", object_id=object_id)


class LeaveBalanceViewSet(SchoolScopedModelViewSet):
    queryset = LeaveBalance.objects.select_related("staff", "leave_type").all()
    serializer_class = LeaveBalanceSerializer
    permission_codes = {"*": "settings.leave_policy.view"}

    def get_queryset(self):
        qs = super().get_queryset()
        staff_id = self.request.query_params.get("staff")
        leave_type_id = self.request.query_params.get("leave_type")
        year = self.request.query_params.get("year")
        if staff_id:
            qs = qs.filter(staff_id=staff_id)
        if leave_type_id:
            qs = qs.filter(leave_type_id=leave_type_id)
        if year:
            qs = qs.filter(year=year)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        school = user.school or getattr(self.request, "school", None)
        if not school and not user.is_superuser:
            raise PermissionDenied("School context is required.")
        instance = serializer.save(school=school)
        log_settings_action(self.request, "leave_balance.create", object_type="LeaveBalance", object_id=instance.pk)

    def perform_update(self, serializer):
        instance = serializer.save()
        log_settings_action(self.request, "leave_balance.update", object_type="LeaveBalance", object_id=instance.pk)

    @action(detail=True, methods=["post"])
    def adjust(self, request, pk=None):
        """Apply a delta to total_days (positive or negative), e.g. a manual
        correction — separate from the carry-forward engine's own writes."""
        instance = self.get_object()
        try:
            delta = float(request.data.get("delta_days"))
        except (TypeError, ValueError):
            raise ValidationError({"delta_days": ["A numeric delta_days is required."]})
        instance.total_days = instance.total_days + delta
        instance.save(update_fields=["total_days", "updated_at"])
        log_settings_action(
            self.request, "leave_balance.adjust", object_type="LeaveBalance", object_id=instance.pk,
            changes={"delta_days": delta, "reason": request.data.get("reason", "")},
        )
        return Response(self.get_serializer(instance).data)


class LeaveCarryForwardYearsView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not request.user.is_superuser and not (
            hasattr(request.user, "has_permission_code") and request.user.has_permission_code("settings.leave_policy.view")
        ):
            raise PermissionDenied("You do not have permission to view leave data.")
        years = list(
            LeaveBalance.objects.filter(school_id=request.user.school_id)
            .values_list("year", flat=True)
            .distinct()
            .order_by("year")
        )
        return Response({"years": years})


class LeaveCarryForwardPreviewView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if not user.is_superuser and not (
            hasattr(user, "has_permission_code") and user.has_permission_code("settings.leave_policy.view")
        ):
            raise PermissionDenied("You do not have permission to run carry-forward.")
        try:
            from_year = int(request.data.get("from_year"))
            to_year = int(request.data.get("to_year"))
        except (TypeError, ValueError):
            raise ValidationError({"non_field_errors": ["from_year and to_year are required."]})
        rows = compute_carry_forward(user.school_id, from_year, to_year)
        return Response({"from_year": from_year, "to_year": to_year, "rows": rows})


class LeaveCarryForwardRunView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if not user.is_superuser and not (
            hasattr(user, "has_permission_code") and user.has_permission_code("settings.leave_policy.view")
        ):
            raise PermissionDenied("You do not have permission to run carry-forward.")
        try:
            from_year = int(request.data.get("from_year"))
            to_year = int(request.data.get("to_year"))
        except (TypeError, ValueError):
            raise ValidationError({"non_field_errors": ["from_year and to_year are required."]})
        log = run_carry_forward(user.school_id, from_year, to_year, user)
        log_settings_action(
            request, "leave_carry_forward.run", object_type="CarryForwardLog", object_id=log.pk,
            changes={"from_year": from_year, "to_year": to_year, "processed": log.total_processed},
        )
        return Response(CarryForwardLogSerializer(log).data, status=status.HTTP_201_CREATED)


class LeaveCarryForwardHistoryView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CarryForwardLogSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.school_id:
            return CarryForwardLog.objects.none()
        if not user.is_superuser and not (
            hasattr(user, "has_permission_code") and user.has_permission_code("settings.leave_policy.view")
        ):
            raise PermissionDenied("You do not have permission to view carry-forward history.")
        return CarryForwardLog.objects.filter(school_id=user.school_id)


class LeaveOpeningBalanceImportView(generics.GenericAPIView):
    """CSV bulk-import of opening leave balances. Columns: staff_no,
    leave_type, year, total_days. Upserts one LeaveBalance row per line."""

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        import csv
        import io

        from apps.hr.models import Staff

        user = request.user
        if not user.is_superuser and not (
            hasattr(user, "has_permission_code") and user.has_permission_code("settings.leave_policy.view")
        ):
            raise PermissionDenied("You do not have permission to import leave balances.")

        upload = request.FILES.get("file")
        if not upload:
            raise ValidationError({"file": ["A CSV file is required."]})

        try:
            text = upload.read().decode("utf-8-sig")
        except UnicodeDecodeError:
            raise ValidationError({"file": ["File must be UTF-8 encoded CSV."]})

        reader = csv.DictReader(io.StringIO(text))
        required_cols = {"staff_no", "leave_type", "year", "total_days"}
        if not required_cols.issubset({c.strip() for c in (reader.fieldnames or [])}):
            raise ValidationError({"file": [f"CSV must have columns: {', '.join(sorted(required_cols))}"]})

        imported = 0
        errors = []
        for i, row in enumerate(reader, start=2):
            try:
                staff = Staff.objects.get(school_id=user.school_id, staff_no=row["staff_no"].strip())
                leave_type = LeaveType.objects.get(school_id=user.school_id, name__iexact=row["leave_type"].strip())
                year = int(row["year"])
                total_days = float(row["total_days"])
                LeaveBalance.objects.update_or_create(
                    school_id=user.school_id, staff=staff, leave_type=leave_type, year=year,
                    defaults={"total_days": total_days},
                )
                imported += 1
            except Staff.DoesNotExist:
                errors.append(f"Row {i}: staff_no '{row.get('staff_no')}' not found.")
            except LeaveType.DoesNotExist:
                errors.append(f"Row {i}: leave_type '{row.get('leave_type')}' not found.")
            except (ValueError, KeyError) as exc:
                errors.append(f"Row {i}: {exc}")

        log_settings_action(
            request, "leave_balance.import", object_type="LeaveBalance",
            changes={"imported": imported, "error_count": len(errors)},
        )
        return Response({"imported": imported, "errors": errors})


class StaffHolidayExclusionViewSet(SchoolScopedModelViewSet):
    queryset = StaffHolidayExclusion.objects.select_related("holiday").all()
    serializer_class = StaffHolidayExclusionSerializer
    permission_codes = {"*": "settings.holidays.view"}

    def perform_create(self, serializer):
        user = self.request.user
        school = user.school or getattr(self.request, "school", None)
        if not school and not user.is_superuser:
            raise PermissionDenied("School context is required.")
        instance = serializer.save(school=school, created_by=user)
        log_settings_action(
            self.request, "holiday_exclusion.create", object_type="Holiday", object_id=instance.holiday_id,
        )

    def perform_destroy(self, instance):
        holiday_id = instance.holiday_id
        super().perform_destroy(instance)
        log_settings_action(self.request, "holiday_exclusion.delete", object_type="Holiday", object_id=holiday_id)


class StaffHolidayCalendarView(generics.ListAPIView):
    """Read-only staff-facing calendar: apps.core.Holiday rows with
    audience in [all, staff_only], minus this school's StaffHolidayExclusion
    rows. Source of truth stays Holiday itself — never a forked copy."""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = StaffHolidaySerializer

    def get_queryset(self):
        user = self.request.user
        if not user.school_id:
            return Holiday.objects.none()
        excluded_ids = StaffHolidayExclusion.objects.filter(school_id=user.school_id).values_list(
            "holiday_id", flat=True
        )
        return (
            Holiday.objects.filter(school_id=user.school_id, active_status=True)
            .filter(audience__in=[Holiday.AUDIENCE_ALL, Holiday.AUDIENCE_STAFF_ONLY])
            .exclude(id__in=excluded_ids)
            .order_by("date")
        )


class SchoolSMTPSettingsViewSet(SchoolScopedModelViewSet):
    queryset = SchoolSMTPSettings.objects.all()
    serializer_class = SchoolSMTPSettingsSerializer
    permission_codes = {"*": "settings.smtp.view"}

    def perform_create(self, serializer):
        user = self.request.user
        school = user.school or getattr(self.request, "school", None)
        if not school and not user.is_superuser:
            raise PermissionDenied("School context is required.")
        instance = serializer.save(school=school, updated_by=user)
        log_settings_action(self.request, "smtp.create", object_type="SchoolSMTPSettings", object_id=instance.pk)

    def perform_update(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        log_settings_action(self.request, "smtp.update", object_type="SchoolSMTPSettings", object_id=instance.pk)

    def perform_destroy(self, instance):
        object_id = instance.pk
        super().perform_destroy(instance)
        log_settings_action(self.request, "smtp.delete", object_type="SchoolSMTPSettings", object_id=object_id)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        instance = self.get_object()
        instance.activate()
        log_settings_action(request, "smtp.activate", object_type="SchoolSMTPSettings", object_id=instance.pk)
        return Response(self.get_serializer(instance).data)

    @action(detail=False, methods=["post"])
    def test_send(self, request):
        """Send a test email using UNSAVED form data (no config needs to be
        persisted first) — mirrors the Royal HRMS pattern."""
        from django.core.mail import EmailMultiAlternatives

        data = request.data
        to_email = data.get("to_email") or request.user.email
        if not to_email:
            raise ValidationError({"to_email": ["No recipient email available."]})

        try:
            connection_kwargs = dict(
                host=data["host"],
                port=int(data["port"]),
                username=data.get("username", ""),
                password=data.get("password", ""),
                use_tls=bool(data.get("use_tls", True)),
            )
        except (KeyError, ValueError, TypeError):
            raise ValidationError({"non_field_errors": ["host and port are required to send a test email."]})

        from django.core.mail.backends.smtp import EmailBackend

        connection = EmailBackend(**connection_kwargs, fail_silently=False)
        message = EmailMultiAlternatives(
            subject="Eskoolia SMTP test email",
            body="This is a test email sent from Settings > SMTP Settings.",
            from_email=data.get("from_email") or connection_kwargs["username"],
            to=[to_email],
            connection=connection,
        )
        try:
            message.send()
        except Exception as exc:  # noqa: BLE001 - surface the real SMTP error to the admin
            raise ValidationError({"non_field_errors": [f"Failed to send test email: {exc}"]})

        log_settings_action(request, "smtp.test_send", object_type="SchoolSMTPSettings")
        return Response({"success": True, "message": f"Test email sent to {to_email}."})


class SettingsAuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SettingsAuditLog.objects.select_related("actor").all()
    serializer_class = SettingsAuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    permission_codes = {"*": "settings.audit_log.view"}

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        code = self.permission_codes.get("*")
        user = request.user
        if user.is_superuser:
            return
        if not hasattr(user, "has_permission_code") or not user.has_permission_code(code):
            raise PermissionDenied("You do not have permission to view the audit log.")

    def get_queryset(self):
        user = self.request.user
        if not user.school_id:
            return SettingsAuditLog.objects.none()
        qs = SettingsAuditLog.objects.select_related("actor").filter(school_id=user.school_id)

        module = self.request.query_params.get("module")
        object_id = self.request.query_params.get("object_id")
        action_q = self.request.query_params.get("action")
        actor_q = self.request.query_params.get("actor")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")

        if module:
            qs = qs.filter(object_type__iexact=module)
        if object_id:
            qs = qs.filter(object_id=str(object_id))
        if action_q:
            qs = qs.filter(action__icontains=action_q)
        if actor_q:
            qs = qs.filter(actor__username__icontains=actor_q)
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        return qs


class SchoolAttendancePolicyViewSet(SchoolScopedModelViewSet):
    """Multiple named attendance policies per school (e.g. 'Teaching Staff',
    'Non-Teaching Staff'), one marked is_default. Replaces the earlier
    one-per-school singleton."""

    queryset = SchoolAttendancePolicy.objects.all()
    serializer_class = SchoolAttendancePolicySerializer
    permission_codes = {"*": "settings.attendance_rules.view"}

    def perform_create(self, serializer):
        user = self.request.user
        school = user.school or getattr(self.request, "school", None)
        if not school and not user.is_superuser:
            raise PermissionDenied("School context is required.")
        is_first = not SchoolAttendancePolicy.objects.filter(school_id=school.id if school else None).exists()
        instance = serializer.save(school=school, created_by=user, updated_by=user, is_default=is_first)
        log_settings_action(
            self.request, "attendance_policy.create", object_type="SchoolAttendancePolicy", object_id=instance.pk,
        )

    def perform_update(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        log_settings_action(
            self.request, "attendance_policy.update", object_type="SchoolAttendancePolicy", object_id=instance.pk,
        )

    def perform_destroy(self, instance):
        was_default = instance.is_default
        school_id = instance.school_id
        object_id = instance.pk
        super().perform_destroy(instance)
        if was_default:
            # Promote another active policy to default so there's always one,
            # unless this was the school's only policy.
            fallback = SchoolAttendancePolicy.objects.filter(school_id=school_id, is_active=True).first()
            if fallback:
                fallback.make_default()
        log_settings_action(
            self.request, "attendance_policy.delete", object_type="SchoolAttendancePolicy", object_id=object_id,
        )

    @action(detail=True, methods=["post"])
    def make_default(self, request, pk=None):
        instance = self.get_object()
        instance.make_default()
        log_settings_action(
            request, "attendance_policy.make_default", object_type="SchoolAttendancePolicy", object_id=instance.pk,
        )
        return Response(self.get_serializer(instance).data)


class SchoolPolicyDocumentViewSet(SchoolScopedModelViewSet):
    queryset = SchoolPolicyDocument.objects.filter(is_active=True)
    serializer_class = SchoolPolicyDocumentSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_codes = {"*": "settings.documents.view"}

    def get_queryset(self):
        qs = super().get_queryset()
        category = self.request.query_params.get("category")
        file_type = self.request.query_params.get("file_type")
        search = self.request.query_params.get("search")
        if category:
            qs = qs.filter(category=category)
        if file_type:
            qs = qs.filter(file_type__iexact=file_type)
        if search:
            qs = qs.filter(title__icontains=search)
        return qs

    @action(detail=False, methods=["get"])
    def stats(self, request):
        from django.db.models import Count

        qs = self.get_queryset()
        by_category = list(qs.values("category").annotate(count=Count("id")).order_by("category"))
        by_file_type = list(qs.values("file_type").annotate(count=Count("id")).order_by("file_type"))
        return Response({"total": qs.count(), "by_category": by_category, "by_file_type": by_file_type})

    def perform_create(self, serializer):
        user = self.request.user
        school = user.school or getattr(self.request, "school", None)
        if not school and not user.is_superuser:
            raise PermissionDenied("School context is required.")
        instance = serializer.save(school=school, uploaded_by=user)
        log_settings_action(
            self.request, "document.upload", object_type="SchoolPolicyDocument", object_id=instance.pk,
        )

    def perform_destroy(self, instance):
        # Soft delete — keeps the audit trail meaningful and avoids orphaning
        # the media_views.py ownership check for a file that still exists on disk.
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        log_settings_action(
            self.request, "document.delete", object_type="SchoolPolicyDocument", object_id=instance.pk,
        )
