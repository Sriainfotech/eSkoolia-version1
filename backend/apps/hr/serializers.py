import json
import calendar
from datetime import date, timedelta
from django.db.models import Sum
from django.core.validators import FileExtensionValidator
import re
from django.utils import timezone
from decimal import Decimal, InvalidOperation
from apps.access_control.models import Role
from apps.core.models import Class as SchoolClass, Section
from apps.students.models import Student
from rest_framework import serializers

from .models import Department, Designation, DepartmentType, LeaveDefine, LeaveRequest, LeaveType, PayrollRecord, PayrollSettings, Staff, StaffAttendance, StaffDocument, StaffOnboardDocument, PREDEFINED_DEPARTMENT_TYPES


def _is_valid_person_name(value: str) -> bool:
    """Unified validator for all person names (first, last, middle, spouse, emergency, nominee).

    Accepts: letters, spaces, dot, apostrophe, hyphen. Min 3, max 100 chars.
    Must start with a letter. Rejects numbers, special chars, 3+ repeated chars,
    4+ consecutive keyboard-row chars, and vowel-free segments of 3+ chars.
    Valid examples: Veni, Ravi, Raju, Sita, Geeta, Deepa, Kiran, Sai Teja
    """
    t = value.strip()
    if len(t) < 3 or len(t) > 100:
        return False
    if not re.match(r"^[A-Za-z][A-Za-z .'\-]{2,99}$", t):
        return False
    if re.search(r"(.)\1{2,}", t, re.IGNORECASE):
        return False
    flat = re.sub(r"[\s.'\-]", "", t).lower()
    for row in ["qwertyuiop", "asdfghjkl", "zxcvbnm"]:
        for i in range(len(row) - 3):
            if row[i:i + 4] in flat:
                return False
    for seg in re.split(r"[\s.'\-]+", t):
        alpha = re.sub(r"[^a-zA-Z]", "", seg)
        if len(alpha) >= 3 and not re.search(r"[aeiou]", alpha, re.IGNORECASE):
            return False
    return True


# Keep legacy aliases so any other callers still work
def _is_gibberish_name(value: str) -> bool:
    return not _is_valid_person_name(value) if value.strip() else False


def _is_gibberish_address(value: str) -> bool:
    """Return True if the address looks like gibberish (3+ consecutive identical chars or 5+ consecutive consonants)."""
    t = value.strip()
    if len(t) < 4:
        return False
    if re.search(r'(.)\1{2,}', t, re.IGNORECASE):
        return True
    if re.search(r'[bcdfghjklmnpqrstvwxyz]{5,}', t, re.IGNORECASE):
        return True
    return False


def _is_gibberish_place_name(value: str) -> bool:
    """Return True if a place name (city/state/country) looks like gibberish."""
    t = value.strip()
    if len(t) < 3:
        return False
    if re.search(r'(.)\1{2,}', t, re.IGNORECASE):
        return True
    if re.search(r'[bcdfghjklmnpqrstvwxyz]{5,}', t, re.IGNORECASE):
        return True
    return False


def _is_valid_nominee_name(value: str) -> bool:
    """Deprecated alias – use _is_valid_person_name instead."""
    return _is_valid_person_name(value)


class FileNameCharField(serializers.CharField):
    """Accept either plain strings or uploaded file objects and store only the file name."""

    def to_internal_value(self, data):
        if hasattr(data, "name"):
            data = getattr(data, "name", "")
        if data is None:
            data = ""
        return super().to_internal_value(str(data))


class DepartmentTypeSerializer(serializers.ModelSerializer):
    is_predefined = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = DepartmentType
        fields = ["id", "name", "is_predefined", "created_at"]
        read_only_fields = ["id", "is_predefined", "created_at"]

    def get_is_predefined(self, obj):
        return False  # only custom types live in the DB

    def validate_name(self, value):
        cleaned = (value or "").strip()
        if not cleaned:
            raise serializers.ValidationError("Type name is required.")
        if len(cleaned) > 50:
            raise serializers.ValidationError("Type name must not exceed 50 characters.")
        if not re.fullmatch(r"[A-Za-z &\-]+", cleaned):
            raise serializers.ValidationError("Only letters, spaces, & and hyphens allowed.")
        predefined_lower = {t.lower() for t in PREDEFINED_DEPARTMENT_TYPES}
        if cleaned.lower() in predefined_lower:
            raise serializers.ValidationError(
                f'"{cleaned}" is a predefined type — select it from the dropdown instead.'
            )
        # Check school-scoped uniqueness (case-insensitive)
        request = self.context.get("request")
        school = getattr(getattr(request, "user", None), "school", None)
        if school:
            qs = DepartmentType.objects.filter(school=school, name__iexact=cleaned)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(f'A custom type named "{cleaned}" already exists.')
        return cleaned.title()


class DepartmentSerializer(serializers.ModelSerializer):
    PREDEFINED_TYPES = ["Academic", "Administrative", "Support", "Transport", "Finance"]

    head_id = serializers.PrimaryKeyRelatedField(
        source="head", queryset=Staff.objects.all(), allow_null=True, required=False
    )
    deputy_head_id = serializers.PrimaryKeyRelatedField(
        source="deputy_head", queryset=Staff.objects.all(), allow_null=True, required=False
    )
    head_name = serializers.SerializerMethodField()
    deputy_head_name = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = [
            "id", "school", "name", "dept_type", "description", "is_active",
            "head_id", "deputy_head_id", "head_name", "deputy_head_name",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "school", "head_name", "deputy_head_name", "created_at", "updated_at"]
        extra_kwargs = {
            "name": {
                "error_messages": {
                    "required": "Department name is required.",
                }
            }
        }

    def get_head_name(self, obj):
        return str(obj.head) if obj.head_id else None

    def get_deputy_head_name(self, obj):
        return str(obj.deputy_head) if obj.deputy_head_id else None

    def validate_dept_type(self, value):
        cleaned = (value or "").strip()
        if not cleaned:
            return cleaned  # optional field

        if len(cleaned) > 50:
            raise serializers.ValidationError("Department type must not exceed 50 characters.")

        if not re.fullmatch(r"[A-Za-z &\-]+", cleaned):
            raise serializers.ValidationError(
                "Department type can only contain letters, spaces, &, and hyphens."
            )

        # Normalise to canonical casing if it matches a predefined type
        predefined_map = {t.lower(): t for t in self.PREDEFINED_TYPES}
        if cleaned.lower() in predefined_map:
            return predefined_map[cleaned.lower()]

        # For custom types, title-case each word for consistency
        return cleaned.title()


    def validate_name(self, value):
        normalized = (value or "").strip()
        if not normalized:
            raise serializers.ValidationError("Department name is required.")
        if len(normalized) < 3 or len(normalized) > 50:
            raise serializers.ValidationError("Department name length must be between 3 and 50 characters.")
        if not re.fullmatch(r"[A-Za-z ]+", normalized):
            raise serializers.ValidationError("Department name can contain only letters and spaces.")

        # Allow no-change updates for legacy data where case-insensitive duplicates already exist.
        if self.instance and (self.instance.name or "").strip().lower() == normalized.lower():
            return normalized

        request = self.context.get("request")
        school = getattr(getattr(request, "user", None), "school", None) or getattr(self.instance, "school", None)
        if school:
            duplicate_qs = Department.objects.filter(school=school, name__iexact=normalized)
            if self.instance:
                duplicate_qs = duplicate_qs.exclude(pk=self.instance.pk)
            if duplicate_qs.exists():
                raise serializers.ValidationError("Department already exists")

        return normalized

    def validate_description(self, value):
        text = (value or "").strip()
        if len(text) > 255:
            raise serializers.ValidationError("Description must not exceed 255 characters.")
        return text


class DesignationSerializer(serializers.ModelSerializer):
    department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(),
        error_messages={
            "required": "Department is required.",
            "does_not_exist": "Department not found",
            "incorrect_type": "Department not found",
            "invalid": "Department not found",
        },
    )
    department_name = serializers.SerializerMethodField()

    class Meta:
        model = Designation
        fields = [
            "id", "school", "department", "department_name",
            "name", "short_code", "role_template", "employment_type",
            "reports_to", "grade_level", "sort_order",
            "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "school", "department_name", "created_at", "updated_at"]
        extra_kwargs = {
            "name": {
                "error_messages": {
                    "required": "Designation name is required.",
                }
            }
        }

    def get_department_name(self, obj):
        return obj.department.name if obj.department_id else None

    def validate_name(self, value):
        normalized = (value or "").strip()
        if not normalized:
            raise serializers.ValidationError("Designation name is required.")
        if len(normalized) < 3 or len(normalized) > 50:
            raise serializers.ValidationError("Designation name length must be between 3 and 50 characters.")
        if not re.fullmatch(r"[A-Za-z ]+", normalized):
            raise serializers.ValidationError("Designation name can contain only letters and spaces.")
        return normalized

    def validate(self, attrs):
        request = self.context.get("request")
        school_id = request.user.school_id if request else None
        department = attrs.get("department") or getattr(self.instance, "department", None)
        name = attrs.get("name") or getattr(self.instance, "name", "")

        if department is None:
            raise serializers.ValidationError({"department": "Department is required."})

        if school_id and department and department.school_id != school_id:
            raise serializers.ValidationError({"department": "Selected department does not belong to your school."})

        # 400 duplicate check within same department (case-insensitive)
        if school_id and department and name:
            duplicate_qs = Designation.objects.filter(
                school_id=school_id,
                department_id=department.id,
                name__iexact=name.strip(),
            )
            if self.instance:
                duplicate_qs = duplicate_qs.exclude(pk=self.instance.pk)
            if duplicate_qs.exists():
                raise serializers.ValidationError({"name": "Designation already exists in this department"})

        return attrs


class StaffDocumentSerializer(serializers.ModelSerializer):
    """
    Serializer for staff document uploads with proper validation.
    Supports multiple file uploads with type categorization.
    """
    document_type_display = serializers.CharField(source="get_document_type_display", read_only=True)
    
    class Meta:
        model = StaffDocument
        fields = [
            "id",
            "staff",
            "document_type",
            "document_type_display",
            "file_path",
            "file_name",
            "file_size",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        request = self.context.get("request")
        school_id = request.user.school_id if request else None
        staff = attrs.get("staff") or getattr(self.instance, "staff", None)

        if staff is None:
            raise serializers.ValidationError({"staff": "Staff is required."})

        if school_id and staff.school_id != school_id:
            raise serializers.ValidationError({"staff": "Selected staff does not belong to your school."})

        return attrs

    def validate_document_type(self, value):
        """Validate document type is one of allowed choices."""
        valid_types = dict(StaffDocument.DOCUMENT_TYPE_CHOICES).keys()
        if value not in valid_types:
            raise serializers.ValidationError(f"Invalid document type. Must be one of: {', '.join(valid_types)}")
        return value

    def validate_file_name(self, value):
        """Validate file name is not empty and doesn't contain invalid characters."""
        if not value or not value.strip():
            raise serializers.ValidationError("File name cannot be empty.")
        # Allow alphanumeric, dots, hyphens, underscores only
        if not re.match(r'^[\w\-. ]+$', value):
            raise serializers.ValidationError("File name contains invalid characters.")
        return value.strip()

    def validate_file_size(self, value):
        """Validate file size (max 50MB)."""
        max_size = 50 * 1024 * 1024  # 50MB
        if value > max_size:
            raise serializers.ValidationError(f"File size exceeds maximum allowed size of 50MB.")
        if value <= 0:
            raise serializers.ValidationError("File size must be greater than 0.")
        return value

    def validate_file_path(self, value):
        """Validate file path is not empty."""
        if not value or not value.strip():
            raise serializers.ValidationError("File path cannot be empty.")
        return value.strip()


class StaffSerializer(serializers.ModelSerializer):
    staff_photo = serializers.ImageField(
        required=False,
        allow_null=True,
        validators=[FileExtensionValidator(allowed_extensions=["jpg", "jpeg", "png"])],
    )
    resume = FileNameCharField(required=False, allow_blank=True, max_length=300)
    joining_letter = FileNameCharField(required=False, allow_blank=True, max_length=300)
    tenth_certificate = FileNameCharField(required=False, allow_blank=True, max_length=300)
    eleventh_certificate = FileNameCharField(required=False, allow_blank=True, max_length=300)
    aadhar_card = FileNameCharField(required=False, allow_blank=True, max_length=300)
    driving_license_doc = FileNameCharField(required=False, allow_blank=True, max_length=300)
    other_document = serializers.ListField(
        child=serializers.CharField(allow_blank=False, trim_whitespace=True, max_length=300),
        required=False,
        allow_empty=True,
    )

    role = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(),
        required=False,
        allow_null=True,
        error_messages={
            "does_not_exist": "Role not found",
            "incorrect_type": "Role not found",
            "invalid": "Role not found",
        },
    )
    department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(),
        required=False,
        allow_null=True,
        error_messages={
            "does_not_exist": "Department not found",
            "incorrect_type": "Department not found",
            "invalid": "Department not found",
        },
    )
    designation = serializers.PrimaryKeyRelatedField(
        queryset=Designation.objects.all(),
        required=False,
        allow_null=True,
        error_messages={
            "does_not_exist": "Designation not found",
            "incorrect_type": "Designation not found",
            "invalid": "Designation not found",
        },
    )

    class Meta:
        model = Staff
        fields = [
            "id",
            "school",
            "user",
            "role",
            "staff_no",
            "first_name",
            "last_name",
            "fathers_name",
            "mothers_name",
            "date_of_birth",
            "email",
            "phone",
            "emergency_mobile",
            "gender",
            "marital_status",
            "driving_license",
            "staff_photo",
            "current_address",
            "permanent_address",
            "qualification",
            "experience",
            "epf_no",
            "bank_account_name",
            "bank_account_no",
            "bank_name",
            "bank_branch",
            "bank_mobile_no",
            "facebook_url",
            "twitter_url",
            "linkedin_url",
            "instagram_url",
            "casual_leave",
            "medical_leave",
            "maternity_leave",
            "show_public",
            "custom_field",
            "department",
            "designation",
            "contract_type",
            "location",
            "resume",
            "joining_letter",
            "tenth_certificate",
            "eleventh_certificate",
            "aadhar_card",
            "driving_license_doc",
            "other_document",
            "join_date",
            "basic_salary",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "school", "created_at", "updated_at"]

    @staticmethod
    def _normalize_other_documents(value):
        if value is None:
            return []

        if isinstance(value, (list, tuple)):
            normalized = []
            for item in value:
                if hasattr(item, "name"):
                    text = str(item.name or "").strip()
                else:
                    text = str(item or "").strip()
                if text:
                    normalized.append(text)
            return normalized

        if isinstance(value, str):
            text = value.strip()
            if not text:
                return []
            try:
                parsed = json.loads(text)
                if isinstance(parsed, list):
                    return [str(item).strip() for item in parsed if str(item).strip()]
            except (TypeError, ValueError, json.JSONDecodeError):
                pass
            return [text]

        return [str(value).strip()] if str(value).strip() else []

    @staticmethod
    def _normalize_text_input(value):
        if value is None:
            return ""
        if hasattr(value, "name"):
            return str(value.name or "").strip()
        return str(value).strip()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["other_document"] = self._normalize_other_documents(getattr(instance, "other_document", []))

        # Compute probation_end_date from custom_field + join_date
        try:
            custom = data.get("custom_field") or {}
            pv = custom.get("probation_value")
            pu = str(custom.get("probation_unit", "")).lower()
            jd = getattr(instance, "join_date", None)
            if pv and pu and jd:
                pv = int(pv)
                if not isinstance(jd, date):
                    jd = date.fromisoformat(str(jd))
                if pu == "days":
                    end = jd + timedelta(days=pv)
                elif pu == "months":
                    m = jd.month + pv
                    y = jd.year + (m - 1) // 12
                    m = (m - 1) % 12 + 1
                    d = min(jd.day, calendar.monthrange(y, m)[1])
                    end = date(y, m, d)
                elif pu == "years":
                    end = date(jd.year + pv, jd.month, jd.day)
                else:
                    end = None
                if end:
                    data["probation_end_date"] = end.isoformat()
        except Exception:
            pass

        return data

    def to_internal_value(self, data):
        mutable_data = data.copy() if hasattr(data, "copy") else dict(data)

        # QueryDict keeps repeated keys in getlist; use that for multi-file/name document input.
        if hasattr(data, "getlist") and "other_document" in data:
            mutable_data["other_document"] = self._normalize_other_documents(data.getlist("other_document"))
        elif "other_document" in mutable_data:
            mutable_data["other_document"] = self._normalize_other_documents(mutable_data.get("other_document"))

        custom_field = mutable_data.get("custom_field")
        if isinstance(custom_field, str):
            custom_field_text = custom_field.strip()
            if custom_field_text:
                try:
                    parsed_custom = json.loads(custom_field_text)
                    if isinstance(parsed_custom, dict):
                        mutable_data["custom_field"] = parsed_custom
                except (TypeError, ValueError, json.JSONDecodeError):
                    # Preserve original value so serializer can emit a proper validation error if needed.
                    pass

        for field_name in [
            "resume",
            "joining_letter",
            "tenth_certificate",
            "eleventh_certificate",
            "aadhar_card",
            "driving_license_doc",
        ]:
            if field_name in mutable_data:
                mutable_data[field_name] = self._normalize_text_input(mutable_data.get(field_name))

        return super().to_internal_value(mutable_data)

    def validate_staff_photo(self, value):
        if not value:
            return value
        max_size = 2 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError("File size must be 2MB or less.")
        return value

    def validate_status(self, value):
        """Ensure status is one of the allowed choices; block inactive during staff creation (onboarding)."""
        allowed = {Staff.STATUS_ACTIVE, Staff.STATUS_INACTIVE, Staff.STATUS_TERMINATED}
        if value not in allowed:
            raise serializers.ValidationError(
                f'Invalid status "{value}". Must be one of: {", ".join(sorted(allowed))}.'
            )
        # During onboarding (create), prevent inactive status — staff must be active to be onboarded
        if self.instance is None and value == Staff.STATUS_INACTIVE:
            raise serializers.ValidationError(
                "Inactive staff cannot proceed with onboarding. Change status to Active."
            )
        return value

    def _apply_payroll_defaults(self, custom_field, school):
        current = dict(custom_field or {})
        if not school:
            return current

        settings = PayrollSettings.objects.filter(school=school).first()
        if not settings:
            return current

        payroll_defaults = current.get("payroll_defaults")
        if not isinstance(payroll_defaults, dict):
            payroll_defaults = {}

        allowance_items = payroll_defaults.get("allowance_items")
        if not isinstance(allowance_items, list) or len(allowance_items) == 0:
            payroll_defaults["allowance_items"] = settings.default_allowance_items or []

        deduction_items = payroll_defaults.get("deduction_items")
        if not isinstance(deduction_items, list) or len(deduction_items) == 0:
            payroll_defaults["deduction_items"] = settings.default_deduction_items or []

        if not str(current.get("allowance", "")).strip():
            current["allowance"] = str(settings.default_allowance)
        if not str(current.get("deduction", "")).strip():
            current["deduction"] = str(settings.default_deduction)

        current["payroll_defaults"] = payroll_defaults
        return current

    def create(self, validated_data):
        request = self.context.get("request")
        school = getattr(getattr(request, "user", None), "school", None)
        validated_data["custom_field"] = self._apply_payroll_defaults(validated_data.get("custom_field"), school)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if "custom_field" in validated_data:
            existing_custom = instance.custom_field if isinstance(instance.custom_field, dict) else {}
            incoming_custom = validated_data.get("custom_field") if isinstance(validated_data.get("custom_field"), dict) else {}
            merged_custom = {**existing_custom, **incoming_custom}
        else:
            merged_custom = instance.custom_field if isinstance(instance.custom_field, dict) else {}

        validated_data["custom_field"] = self._apply_payroll_defaults(merged_custom, instance.school)
        return super().update(instance, validated_data)

    def validate(self, attrs):
        request = self.context.get("request")
        school_id = request.user.school_id if request else None
        today = timezone.localdate()
        min_age_years = 18
        max_age_years = 70

        def get_value(field_name):
            if field_name in attrs:
                return attrs.get(field_name)
            return getattr(self.instance, field_name, None)

        department = get_value("department")
        designation = get_value("designation")
        user = get_value("user")
        role = get_value("role")
        staff_no = self._normalize_text_input(get_value("staff_no"))
        first_name = self._normalize_text_input(get_value("first_name"))
        middle_name = self._normalize_text_input(get_value("middle_name"))
        last_name = self._normalize_text_input(get_value("last_name"))
        email = self._normalize_text_input(get_value("email")).lower()
        phone = self._normalize_text_input(get_value("phone"))
        emergency_mobile = self._normalize_text_input(get_value("emergency_mobile"))
        date_of_birth = get_value("date_of_birth")
        join_date = get_value("join_date")
        staff_photo = self._normalize_text_input(get_value("staff_photo"))
        current_address = self._normalize_text_input(get_value("current_address"))
        permanent_address = self._normalize_text_input(get_value("permanent_address"))
        other_document_values = self._normalize_other_documents(get_value("other_document"))
        epf_no = self._normalize_text_input(get_value("epf_no"))
        basic_salary = get_value("basic_salary")
        contract_type = self._normalize_text_input(get_value("contract_type"))
        bank_account_name = self._normalize_text_input(get_value("bank_account_name"))
        bank_account_no = self._normalize_text_input(get_value("bank_account_no"))
        bank_name = self._normalize_text_input(get_value("bank_name"))
        bank_branch = self._normalize_text_input(get_value("bank_branch"))
        facebook_url = self._normalize_text_input(get_value("facebook_url"))
        twitter_url = self._normalize_text_input(get_value("twitter_url"))
        linkedin_url = self._normalize_text_input(get_value("linkedin_url"))
        instagram_url = self._normalize_text_input(get_value("instagram_url"))

        required_errors = {}
        if not staff_no:
            required_errors["staff_no"] = "Staff no is required."
        if role is None:
            required_errors["role"] = "Role is required."
        if not first_name:
            required_errors["first_name"] = "First name is required."
        if first_name and not _is_valid_person_name(first_name):
            required_errors["first_name"] = "Please enter a valid name using alphabets only."
        if middle_name and not _is_valid_person_name(middle_name):
            required_errors["middle_name"] = "Please enter a valid name using alphabets only."
        if last_name and len(last_name) > 50:
            required_errors["last_name"] = "Last name cannot exceed 50 characters."
        elif last_name and not _is_valid_person_name(last_name):
            required_errors["last_name"] = "Please enter a valid name using alphabets only."
        if not email:
            required_errors["email"] = "Email is required."
        if not phone:
            required_errors["phone"] = "Mobile number is required."
        if not join_date:
            required_errors["join_date"] = "Joining date is required."
        if not staff_photo:
            required_errors["staff_photo"] = "Staff photo is required."
        if not current_address:
            required_errors["current_address"] = "Current address is required."
        if not permanent_address:
            required_errors["permanent_address"] = "Permanent address is required."
        if not other_document_values:
            required_errors["other_document"] = "Signature upload is required."
        if not bank_account_name:
            required_errors["bank_account_name"] = "Account holder name is required."
        if not bank_account_no:
            required_errors["bank_account_no"] = "Enter valid account number"
        if not bank_name:
            required_errors["bank_name"] = "Bank name is required."
        # bank_branch comes from IFSC lookup — only require it if bank_name is also present
        if bank_name and not bank_branch:
            required_errors["bank_branch"] = "Branch name is required. Please enter a valid IFSC code to auto-fill."
        if basic_salary in (None, ""):
            required_errors["basic_salary"] = "Enter valid salary amount"
        if not contract_type:
            required_errors["contract_type"] = "Select contract type"
        if required_errors:
            raise serializers.ValidationError(required_errors)

        # ========== ADDRESS VALIDATION ==========
        if current_address and len(current_address) < 5:
            raise serializers.ValidationError({"current_address": "Address must be at least 5 characters."})
        if current_address and len(current_address) > 150:
            raise serializers.ValidationError({"current_address": "Address must not exceed 150 characters."})
        if current_address and _is_gibberish_address(current_address):
            raise serializers.ValidationError({"current_address": "Enter a valid address (repeated characters not allowed)."})
        if permanent_address and len(permanent_address) < 5:
            raise serializers.ValidationError({"permanent_address": "Address must be at least 5 characters."})
        if permanent_address and len(permanent_address) > 150:
            raise serializers.ValidationError({"permanent_address": "Address must not exceed 150 characters."})
        if permanent_address and _is_gibberish_address(permanent_address):
            raise serializers.ValidationError({"permanent_address": "Enter a valid address (repeated characters not allowed)."})
        current_address_line2 = self._normalize_text_input(self.initial_data.get("current_address_line2", ""))
        if current_address_line2 and len(current_address_line2) > 100:
            raise serializers.ValidationError({"current_address_line2": "Address line 2 must not exceed 100 characters."})
        if current_address_line2 and _is_gibberish_address(current_address_line2):
            raise serializers.ValidationError({"current_address_line2": "Enter a valid address (repeated characters not allowed)."})
        permanent_address_line2 = self._normalize_text_input(self.initial_data.get("permanent_address_line2", ""))
        if permanent_address_line2 and len(permanent_address_line2) > 100:
            raise serializers.ValidationError({"permanent_address_line2": "Address line 2 must not exceed 100 characters."})
        if permanent_address_line2 and _is_gibberish_address(permanent_address_line2):
            raise serializers.ValidationError({"permanent_address_line2": "Enter a valid address (repeated characters not allowed)."})

        # City / State / Country validation
        _PLACE_RE = re.compile(r"^[A-Za-z\s'\-]+$")
        city = self._normalize_text_input(self.initial_data.get("city", ""))
        if city and not _PLACE_RE.fullmatch(city):
            raise serializers.ValidationError({"city": "City can only contain letters, spaces, hyphens, and apostrophes."})
        if city and _is_gibberish_place_name(city):
            raise serializers.ValidationError({"city": "Enter a valid city name."})
        state = self._normalize_text_input(self.initial_data.get("state", ""))
        if state and not _PLACE_RE.fullmatch(state):
            raise serializers.ValidationError({"state": "State can only contain letters, spaces, hyphens, and apostrophes."})
        if state and _is_gibberish_place_name(state):
            raise serializers.ValidationError({"state": "Enter a valid state name."})
        current_country = self._normalize_text_input(self.initial_data.get("current_country", ""))
        if current_country and not _PLACE_RE.fullmatch(current_country):
            raise serializers.ValidationError({"current_country": "Country can only contain letters, spaces, hyphens, and apostrophes."})
        if current_country and _is_gibberish_place_name(current_country):
            raise serializers.ValidationError({"current_country": "Enter a valid country name."})
        permanent_city = self._normalize_text_input(self.initial_data.get("permanent_city", ""))
        if permanent_city and not _PLACE_RE.fullmatch(permanent_city):
            raise serializers.ValidationError({"permanent_city": "City can only contain letters, spaces, hyphens, and apostrophes."})
        if permanent_city and _is_gibberish_place_name(permanent_city):
            raise serializers.ValidationError({"permanent_city": "Enter a valid city name."})
        permanent_state = self._normalize_text_input(self.initial_data.get("permanent_state", ""))
        if permanent_state and not _PLACE_RE.fullmatch(permanent_state):
            raise serializers.ValidationError({"permanent_state": "State can only contain letters, spaces, hyphens, and apostrophes."})
        if permanent_state and _is_gibberish_place_name(permanent_state):
            raise serializers.ValidationError({"permanent_state": "Enter a valid state name."})
        permanent_country = self._normalize_text_input(self.initial_data.get("permanent_country", ""))
        if permanent_country and not _PLACE_RE.fullmatch(permanent_country):
            raise serializers.ValidationError({"permanent_country": "Country can only contain letters, spaces, hyphens, and apostrophes."})
        if permanent_country and _is_gibberish_place_name(permanent_country):
            raise serializers.ValidationError({"permanent_country": "Enter a valid country name."})

        if email and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            raise serializers.ValidationError({"email": "Enter a valid email address."})

        mobile_pattern = re.compile(r"^\d{1,12}$")
        if phone and not mobile_pattern.fullmatch(phone):
            raise serializers.ValidationError({"phone": "Mobile number must contain digits only and must not exceed 12 digits."})
        if emergency_mobile and not mobile_pattern.fullmatch(emergency_mobile):
            raise serializers.ValidationError({"emergency_mobile": "Mobile number must contain digits only and must not exceed 12 digits."})
        bank_mobile_no = self._normalize_text_input(get_value("bank_mobile_no"))
        if bank_mobile_no and not mobile_pattern.fullmatch(bank_mobile_no):
            raise serializers.ValidationError({"bank_mobile_no": "Mobile number must contain digits only and must not exceed 12 digits."})

        # ========== CONTACT STEP VALIDATION ==========
        custom_field_data = get_value("custom_field") or {}
        if not isinstance(custom_field_data, dict):
            custom_field_data = {}

        personal_email = self._normalize_text_input(custom_field_data.get("personal_email"))
        if personal_email and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]{2,}", personal_email):
            raise serializers.ValidationError({"personal_email": "Enter a valid email address."})

        official_email = self._normalize_text_input(get_value("official_email") or custom_field_data.get("official_email"))
        if official_email and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]{2,}", official_email):
            raise serializers.ValidationError({"official_email": "Enter a valid email address."})

        whatsapp = self._normalize_text_input(custom_field_data.get("whatsapp"))
        whatsapp_digits = re.sub(r"\D", "", whatsapp)
        if whatsapp and len(whatsapp_digits) != 10:
            raise serializers.ValidationError({"whatsapp": "Enter a valid 10-digit mobile number."})

        alternate_mobile = self._normalize_text_input(custom_field_data.get("alternate_mobile"))
        alt_mobile_digits = re.sub(r"\D", "", alternate_mobile)
        if alternate_mobile and len(alt_mobile_digits) != 10:
            raise serializers.ValidationError({"alternate_mobile": "Enter a valid 10-digit mobile number."})

        current_pin = self._normalize_text_input(custom_field_data.get("current_pin"))
        if current_pin and not re.fullmatch(r"\d{5,6}", current_pin):
            raise serializers.ValidationError({"current_pin": "Enter a valid PIN code (5–6 digits)."})

        current_address_val = self._normalize_text_input(get_value("current_address"))
        if current_address_val and len(current_address_val) < 5:
            raise serializers.ValidationError({"current_address": "Address must be at least 5 characters."})
        if current_address_val and not re.search(r"[a-zA-Z0-9]", current_address_val):
            raise serializers.ValidationError({"current_address": "Address cannot contain only special characters."})

        preferred_communication = self._normalize_text_input(get_value("preferred_communication") or custom_field_data.get("preferred_communication"))
        valid_comm_methods = {"mobile", "whatsapp", "personal_email", "official_email"}
        if preferred_communication and preferred_communication not in valid_comm_methods:
            raise serializers.ValidationError({"preferred_communication": "Select preferred communication method."})

        # ========== PROBATION VALIDATION ==========
        probation_value_raw = str(self.initial_data.get("probation_value", "")).strip()
        probation_unit_raw  = str(self.initial_data.get("probation_unit", "")).strip().lower()
        if probation_value_raw:
            try:
                probation_value = int(probation_value_raw)
            except (TypeError, ValueError):
                raise serializers.ValidationError({"probation_value": "Enter valid probation duration."})
            if probation_value <= 0:
                raise serializers.ValidationError({"probation_value": "Enter valid probation duration."})
            valid_units = {"days": 365, "months": 24, "years": 5}
            if probation_unit_raw and probation_unit_raw not in valid_units:
                raise serializers.ValidationError({"probation_unit": "Invalid probation unit. Must be days, months, or years."})
            effective_unit = probation_unit_raw if probation_unit_raw in valid_units else "months"
            max_val = valid_units[effective_unit]
            if probation_value > max_val:
                raise serializers.ValidationError({
                    "probation_value": f"Maximum probation period is {max_val} {effective_unit}."
                })
            custom_field_in_attrs = attrs.get("custom_field") or {}
            if not isinstance(custom_field_in_attrs, dict):
                custom_field_in_attrs = {}
            custom_field_in_attrs["probation_value"] = probation_value
            custom_field_in_attrs["probation_unit"]  = effective_unit
            attrs["custom_field"] = custom_field_in_attrs

        # ========== FAMILY STEP VALIDATION ==========
        valid_marital = {"Single", "Married", "Divorced", "Widowed"}
        marital_status_val = self._normalize_text_input(get_value("marital_status"))
        if marital_status_val and marital_status_val not in valid_marital:
            raise serializers.ValidationError({"marital_status": "Select a valid marital status."})

        num_children_raw = str(self.initial_data.get("num_children", "")).strip()
        if num_children_raw:
            try:
                num_children_val = int(num_children_raw)
                if num_children_val < 0 or num_children_val > 15:
                    raise serializers.ValidationError({"num_children": "Please enter a valid number of children (0–15)."})
            except (TypeError, ValueError):
                raise serializers.ValidationError({"num_children": "Please enter a valid number of children."})

        spouse_name_raw = self._normalize_text_input(str(self.initial_data.get("spouse_parent_name", "")))
        if marital_status_val == "Married" and not spouse_name_raw:
            raise serializers.ValidationError({"spouse_parent_name": "Spouse name is required."})
        if spouse_name_raw and not _is_valid_person_name(spouse_name_raw):
            raise serializers.ValidationError({"spouse_parent_name": "Please enter a valid name using alphabets only."})

        emergency_name_raw = self._normalize_text_input(str(self.initial_data.get("emergency_name", "")))
        if emergency_name_raw and not _is_valid_person_name(emergency_name_raw):
            raise serializers.ValidationError({"emergency_name": "Please enter a valid name using alphabets only."})

        emergency_phone_raw = re.sub(r"\D", "", str(self.initial_data.get("emergency_phone", "")))
        if emergency_phone_raw:
            if len(emergency_phone_raw) != 10 or emergency_phone_raw[0] not in "6789":
                raise serializers.ValidationError({"emergency_phone": "Please enter a valid mobile number."})

        emergency_alt_raw = re.sub(r"\D", "", str(self.initial_data.get("emergency_alt_mobile", "")))
        if emergency_alt_raw:
            if len(emergency_alt_raw) != 10 or emergency_alt_raw[0] not in "6789":
                raise serializers.ValidationError({"emergency_alt_mobile": "Please enter a valid mobile number."})
            if emergency_phone_raw and emergency_alt_raw == emergency_phone_raw:
                raise serializers.ValidationError({"emergency_alt_mobile": "Alternate mobile cannot be the same as primary mobile."})

        # ========== NOMINEE NAME VALIDATION ==========
        # Check any nom_name_N keys in initial_data
        for k, v in self.initial_data.items():
            if k.startswith("nom_name_"):
                _n = str(v).strip()
                if _n and not _is_valid_person_name(_n):
                    raise serializers.ValidationError({"nominees": "Please enter a valid name using alphabets only."})
        # Also check if nominees are nested inside custom_field JSON
        _cf = self.initial_data.get("custom_field") or {}
        if isinstance(_cf, str):
            try:
                _cf = json.loads(_cf)
            except (ValueError, TypeError):
                _cf = {}
        if isinstance(_cf, dict):
            for _nom in (_cf.get("nominees") or []):
                if isinstance(_nom, dict):
                    _n = str(_nom.get("name") or "").strip()
                    if _n and not _is_valid_person_name(_n):
                        raise serializers.ValidationError({"nominees": "Please enter a valid name using alphabets only."})

        # ========== BANK INFO VALIDATION ==========
        # Account Holder Name: Letters, spaces, hyphens, apostrophes; no gibberish
        if bank_account_name:
            if not re.match(r"^[A-Za-z\s\-']{2,50}$", bank_account_name):
                raise serializers.ValidationError({
                    "bank_account_name": "Account holder name can contain only letters, spaces, hyphens, and apostrophes."
                })
            # Require at least 2 words, each at least 2 alphabetic characters
            _ban_words = bank_account_name.split()
            if len(_ban_words) < 2:
                raise serializers.ValidationError({
                    "bank_account_name": "Please enter a valid account holder name (e.g. Ramesh Kumar). Repeated characters, single words, and meaningless text are not allowed."
                })
            if any(len(re.sub(r"['\-]", "", w)) < 2 for w in _ban_words):
                raise serializers.ValidationError({
                    "bank_account_name": "Please enter a valid account holder name (e.g. Ramesh Kumar). Repeated characters, single words, and meaningless text are not allowed."
                })
            # 3+ consecutive identical characters ("aaa", "lll")
            if re.search(r"(.)\1{2,}", bank_account_name, re.IGNORECASE):
                raise serializers.ValidationError({
                    "bank_account_name": "Please enter a valid account holder name (e.g. Ramesh Kumar). Repeated characters, single words, and meaningless text are not allowed."
                })
            # 5+ consecutive consonants (keyboard mash)
            if re.search(r"[bcdfghjklmnpqrstvwxyz]{5,}", bank_account_name, re.IGNORECASE):
                raise serializers.ValidationError({
                    "bank_account_name": "Please enter a valid account holder name (e.g. Ramesh Kumar). Repeated characters, single words, and meaningless text are not allowed."
                })
            # Per-word repeated-substring pattern ("testtest", "abcabc")
            for _w in _ban_words:
                _wl = re.sub(r"['\-]", "", _w.lower())
                if len(_wl) >= 4 and re.fullmatch(r"(.{2,})\1+", _wl):
                    raise serializers.ValidationError({
                        "bank_account_name": "Please enter a valid account holder name (e.g. Ramesh Kumar). Repeated characters, single words, and meaningless text are not allowed."
                    })
            # Any word of 4+ letters with no vowel ("bcdf", "strwth")
            for _w in _ban_words:
                _alpha = re.sub(r"['\-]", "", _w)
                if len(_alpha) >= 4 and not re.search(r"[aeiou]", _alpha, re.IGNORECASE):
                    raise serializers.ValidationError({
                        "bank_account_name": "Please enter a valid account holder name (e.g. Ramesh Kumar). Repeated characters, single words, and meaningless text are not allowed."
                    })

        # Account Number: 9-18 digits, no special characters, reject repeated digits
        if bank_account_no:
            if not re.fullmatch(r"\d+", bank_account_no):
                raise serializers.ValidationError({"bank_account_no": "Only numbers are allowed"})
            if len(bank_account_no) < 9 or len(bank_account_no) > 18:
                raise serializers.ValidationError({"bank_account_no": "Account number must be between 9 and 18 digits"})
            if re.fullmatch(r"(\d)\1+", bank_account_no):
                raise serializers.ValidationError({"bank_account_no": "Account number cannot contain all repeated digits."})

        # Bank Name: Letters, spaces, hyphens, and ampersands only
        if bank_name and not re.match(r"^[A-Za-z\s\-&]{2,120}$", bank_name):
            raise serializers.ValidationError({
                "bank_name": "Bank name can contain only letters, spaces, hyphens, and ampersands."
            })

        # Branch Name: Letters, spaces, hyphens only (fixing the issue where IFSC errors were mapped to branch)
        if bank_branch and not re.match(r"^[A-Za-z\s\-]{2,120}$", bank_branch):
            raise serializers.ValidationError({
                "bank_branch": "Branch name can contain only letters and spaces."
            })

        # IFSC Code: 4 uppercase letters + '0' + 6 alphanumeric
        custom_field = get_value("custom_field") or {}
        ifsc_code = (custom_field.get("ifsc_code") or "").strip().upper() if isinstance(custom_field, dict) else ""
        if ifsc_code:
            if not re.fullmatch(r"[A-Z]{4}0[A-Z0-9]{6}", ifsc_code):
                raise serializers.ValidationError({
                    "ifsc_code": "Please enter a valid IFSC code."
                })

        # ── Merge bank extra fields into custom_field ───────────────────────────
        # ifsc_code, bank_city, bank_state are sent at top level by the frontend;
        # persist them inside the JSON custom_field for storage.
        _cf_mut = dict(attrs.get("custom_field") or {})
        _ifsc_top = str(self.initial_data.get("ifsc_code", "")).strip().upper()
        if _ifsc_top:
            if not re.fullmatch(r"[A-Z]{4}0[A-Z0-9]{6}", _ifsc_top):
                raise serializers.ValidationError({"ifsc_code": "Please enter a valid IFSC code."})
            _cf_mut["ifsc_code"] = _ifsc_top
        _bank_city = str(self.initial_data.get("bank_city", "")).strip()
        if _bank_city:
            if not re.match(r"^[A-Za-z\s\-]{2,80}$", _bank_city):
                raise serializers.ValidationError({"bank_city": "Bank city contains invalid characters."})
            _cf_mut["bank_city"] = _bank_city
        _bank_state = str(self.initial_data.get("bank_state", "")).strip()
        if _bank_state:
            if not re.match(r"^[A-Za-z\s\-]{2,80}$", _bank_state):
                raise serializers.ValidationError({"bank_state": "Bank state contains invalid characters."})
            _cf_mut["bank_state"] = _bank_state
        if _cf_mut != (attrs.get("custom_field") or {}):
            attrs["custom_field"] = _cf_mut

        # ========== GOVERNMENT IDENTITY VALIDATION ==========
        # Aadhaar (nin): exactly 12 digits
        nin_raw = re.sub(r"\D", "", str(self.initial_data.get("nin", "")).strip())
        if nin_raw and not re.fullmatch(r"\d{12}", nin_raw):
            raise serializers.ValidationError({"nin": "Please enter a valid 12-digit Aadhaar number."})

        # PAN: ABCDE1234F (5 uppercase letters + 4 digits + 1 uppercase letter)
        pan_raw = str(self.initial_data.get("pan", "")).strip().upper()
        if pan_raw and not re.fullmatch(r"[A-Z]{5}\d{4}[A-Z]", pan_raw):
            raise serializers.ValidationError({"pan": "Please enter a valid PAN number."})

        # Passport: 1 uppercase letter + 7 digits
        passport_raw = str(self.initial_data.get("passport_no", "")).strip().upper()
        if passport_raw and not re.fullmatch(r"[A-Z]\d{7}", passport_raw):
            raise serializers.ValidationError({"passport_no": "Please enter a valid passport number."})

        # Driving Licence: uppercase letters and digits, 15–18 chars
        dl_raw = str(self.initial_data.get("driving_licence", "")).strip().upper()
        if dl_raw and not re.fullmatch(r"[A-Z0-9]{15,18}", dl_raw):
            raise serializers.ValidationError({"driving_licence": "Please enter a valid Driving Licence number."})

        # UAN: exactly 12 digits
        uan_raw = re.sub(r"\D", "", str(self.initial_data.get("uan", "")).strip())
        if uan_raw and not re.fullmatch(r"\d{12}", uan_raw):
            raise serializers.ValidationError({"uan": "Please enter a valid 12-digit UAN number."})

        # ESI Number: exactly 17 digits
        esi_raw = re.sub(r"\D", "", str(self.initial_data.get("esi_no", "")).strip())
        if esi_raw and not re.fullmatch(r"\d{17}", esi_raw):
            raise serializers.ValidationError({"esi_no": "Please enter a valid ESI number."})

        # PT Registration: alphanumeric, 8–20 chars
        pt_raw = re.sub(r"[^A-Za-z0-9]", "", str(self.initial_data.get("pt_registration", "")).strip())
        if pt_raw and not re.fullmatch(r"[A-Za-z0-9]{8,20}", pt_raw):
            raise serializers.ValidationError({"pt_registration": "Please enter a valid PT Registration number."})

        # Bank Account Number: 9–18 digits only (already validated above, tighten message)
        if bank_account_no and not re.fullmatch(r"\d{9,18}", bank_account_no):
            raise serializers.ValidationError({"bank_account_no": "Please enter a valid bank account number."})

        # Unique bank account number per school
        if school_id and bank_account_no:
            bank_qs = Staff.objects.filter(school_id=school_id, bank_account_no=bank_account_no)
            if self.instance:
                bank_qs = bank_qs.exclude(pk=self.instance.pk)
            if bank_qs.exists():
                raise serializers.ValidationError({"bank_account_no": "This bank account number is already registered for another staff member."})

        try:
            salary_value = Decimal(str(basic_salary))
        except (InvalidOperation, TypeError, ValueError):
            raise serializers.ValidationError({"basic_salary": "Basic Salary must contain numbers only."})
        if salary_value <= 0:
            raise serializers.ValidationError({"basic_salary": "Basic Salary must be greater than zero."})
        if salary_value > Decimal("99999999.99"):
            raise serializers.ValidationError({"basic_salary": "Basic Salary cannot exceed ₹9,99,99,999."})

        # ========== PAYROLL ALLOWANCE VALIDATION ==========
        _PAYROLL_AMOUNT_RE = re.compile(r"^\d{1,6}(\.\d{1,2})?$")
        _MAX_ALLOWANCE     = Decimal("999999.99")

        def _validate_payroll_amount(raw: str, field: str, label: str, required: bool = False) -> None:
            t = str(raw).strip()
            if not t:
                if required:
                    raise serializers.ValidationError({field: f"{label} is required."})
                return
            if not _PAYROLL_AMOUNT_RE.match(t):
                raise serializers.ValidationError({field: f"{label} must be a valid numeric amount."})
            try:
                v = Decimal(t)
            except InvalidOperation:
                raise serializers.ValidationError({field: f"{label} must be a valid numeric amount."})
            if v < 0:
                raise serializers.ValidationError({field: f"{label} must be a valid numeric amount."})
            if v > _MAX_ALLOWANCE:
                raise serializers.ValidationError({field: f"{label} must be a valid numeric amount."})

        _PAYROLL_NAME_RE    = re.compile(r"^[A-Za-z ]+$")
        _PAYROLL_REPEAT_RE  = re.compile(r"(.)\1{2,}", re.IGNORECASE)
        _PAYROLL_ALT_RE     = re.compile(r"(..)\1{2,}", re.IGNORECASE)

        def _validate_payroll_name(raw: str, field: str, label: str) -> None:
            t = str(raw).strip()
            if not t:
                raise serializers.ValidationError({field: f"{label} Name is required."})
            if len(t) < 2 or len(t) > 50:
                raise serializers.ValidationError({field: f"{label} Name must be 2–50 characters."})
            if not _PAYROLL_NAME_RE.match(t):
                raise serializers.ValidationError({field: f"{label} Name must contain alphabetic characters only."})
            if _PAYROLL_REPEAT_RE.search(t) or _PAYROLL_ALT_RE.search(t):
                raise serializers.ValidationError({field: f"Please enter a valid {label.lower()} name."})

        _validate_payroll_amount(
            self.initial_data.get("hra", ""),
            "hra", "HRA",
        )
        _validate_payroll_amount(
            self.initial_data.get("da", ""),
            "da", "DA",
        )
        _validate_payroll_amount(
            self.initial_data.get("travel_allowance", self.initial_data.get("travel_allowance_input", "")),
            "travel_allowance", "Travel Allowance",
        )
        _validate_payroll_amount(
            self.initial_data.get("medical_allowance", self.initial_data.get("medical_allowance_input", "")),
            "medical_allowance", "Medical Allowance",
        )
        _validate_payroll_amount(
            self.initial_data.get("special_allowance", self.initial_data.get("special_allowance_input", "")),
            "special_allowance", "Special Allowance",
        )

        # ── Cross-field ratio validation ────────────────────────────────────
        def _to_decimal(raw) -> Decimal:
            try:
                return Decimal(str(raw).strip())
            except Exception:
                return Decimal("0")

        _basic_val = _to_decimal(basic_salary)
        if _basic_val > 0:
            _hra_raw = self.initial_data.get("hra", "") or ""
            _hra_val = _to_decimal(_hra_raw) if str(_hra_raw).strip() else Decimal("0")
            _hra_limit = (_basic_val * Decimal("0.50")).quantize(Decimal("1"), rounding="ROUND_HALF_UP")
            if _hra_val > _hra_limit:
                raise serializers.ValidationError({
                    "hra": f"HRA cannot exceed 50% of Basic Salary (max ₹{_hra_limit:,})."
                })

            _da_raw = self.initial_data.get("da", "") or ""
            _da_val = _to_decimal(_da_raw) if str(_da_raw).strip() else Decimal("0")
            _da_limit = (_basic_val * Decimal("0.50")).quantize(Decimal("1"), rounding="ROUND_HALF_UP")
            if _da_val > _da_limit:
                raise serializers.ValidationError({
                    "da": f"DA cannot exceed 50% of Basic Salary (max ₹{_da_limit:,})."
                })

            _ta_raw = (self.initial_data.get("travel_allowance") or
                       self.initial_data.get("travel_allowance_input") or "")
            _ta_val = _to_decimal(_ta_raw) if str(_ta_raw).strip() else Decimal("0")
            _ta_limit = (_basic_val * Decimal("0.25")).quantize(Decimal("1"), rounding="ROUND_HALF_UP")
            if _ta_val > _ta_limit:
                raise serializers.ValidationError({
                    "travel_allowance": f"Travel Allowance cannot exceed 25% of Basic Salary (max ₹{_ta_limit:,})."
                })

            _med_raw = (self.initial_data.get("medical_allowance") or
                        self.initial_data.get("medical_allowance_input") or "")
            _med_val = _to_decimal(_med_raw) if str(_med_raw).strip() else Decimal("0")
            _med_limit = (_basic_val * Decimal("0.20")).quantize(Decimal("1"), rounding="ROUND_HALF_UP")
            if _med_val > _med_limit:
                raise serializers.ValidationError({
                    "medical_allowance": f"Medical Allowance cannot exceed 20% of Basic Salary (max ₹{_med_limit:,})."
                })

            _sp_raw = (self.initial_data.get("special_allowance") or
                       self.initial_data.get("special_allowance_input") or "")
            _sp_val = _to_decimal(_sp_raw) if str(_sp_raw).strip() else Decimal("0")
            _sp_limit = _basic_val  # 100%
            if _sp_val > _sp_limit:
                raise serializers.ValidationError({
                    "special_allowance": f"Special Allowance cannot exceed 100% of Basic Salary (max ₹{_sp_limit:,})."
                })

        # Custom allowance rows: expected as JSON array [{"label": "...", "amount": "..."}, ...]
        _custom_allowances_raw = self.initial_data.get("custom_allowances", [])
        if isinstance(_custom_allowances_raw, str):
            try:
                import json as _json
                _custom_allowances_raw = _json.loads(_custom_allowances_raw)
            except Exception:
                _custom_allowances_raw = []
        if isinstance(_custom_allowances_raw, list):
            for _idx, _row in enumerate(_custom_allowances_raw):
                if not isinstance(_row, dict):
                    continue
                _validate_payroll_name(
                    _row.get("label", ""),
                    f"custom_allowances[{_idx}].label", "Allowance",
                )
                _validate_payroll_amount(
                    str(_row.get("amount", "")),
                    f"custom_allowances[{_idx}].amount", "Allowance",
                    required=True,
                )

        # Custom deduction rows
        _custom_deductions_raw = self.initial_data.get("custom_deductions", [])
        if isinstance(_custom_deductions_raw, str):
            try:
                import json as _json
                _custom_deductions_raw = _json.loads(_custom_deductions_raw)
            except Exception:
                _custom_deductions_raw = []
        if isinstance(_custom_deductions_raw, list):
            for _idx, _row in enumerate(_custom_deductions_raw):
                if not isinstance(_row, dict):
                    continue
                _validate_payroll_name(
                    _row.get("label", ""),
                    f"custom_deductions[{_idx}].label", "Deduction",
                )
                _validate_payroll_amount(
                    str(_row.get("amount", "")),
                    f"custom_deductions[{_idx}].amount", "Deduction",
                    required=True,
                )

        if epf_no and not re.fullmatch(r"[A-Za-z0-9\-/]{4,30}", epf_no):
            raise serializers.ValidationError({"epf_no": "Enter a valid EPF number."})

        if contract_type and contract_type not in {"permanent", "contract"}:
            raise serializers.ValidationError({"contract_type": "Select contract type"})

        # ========== QUALIFICATIONS & EXPERIENCE VALIDATION ==========
        _this_year = today.year

        def _is_gibberish_name(v: str) -> bool:
            """3+ consecutive identical characters is gibberish."""
            return bool(re.search(r"(.)\1{2,}", v, re.IGNORECASE))

        # --- Qualification rows from initial_data ---
        _qual_universities = [
            str(self.initial_data.get(k, "")).strip()
            for k in self.initial_data
            if k.startswith("qual_university_")
        ]
        # Also accept flat fields if wizard sends as single block
        _qual_universities += [str(self.initial_data.get("qual_university", "")).strip()]

        for _uni in _qual_universities:
            if not _uni:
                continue
            if len(_uni) < 2 or len(_uni) > 100:
                raise serializers.ValidationError({"qual_university": "University / Board must be 2–100 characters."})
            if not re.match(r"^[A-Za-z\s.&'\-]+$", _uni):
                raise serializers.ValidationError({"qual_university": "University / Board: use letters, spaces, dots, & or hyphens only."})
            if re.match(r"^[^A-Za-z]+$", _uni):
                raise serializers.ValidationError({"qual_university": "University / Board must contain at least one letter."})
            if _is_gibberish_name(_uni):
                raise serializers.ValidationError({"qual_university": "University / Board contains repeated characters."})

        _qual_years = [
            str(self.initial_data.get(k, "")).strip()
            for k in self.initial_data
            if k.startswith("qual_year_")
        ] + [str(self.initial_data.get("qual_year", "")).strip()]

        for _yr in _qual_years:
            if not _yr:
                continue
            if not re.fullmatch(r"\d{4}", _yr) or not (1950 <= int(_yr) <= _this_year + 1):
                raise serializers.ValidationError({"qual_year": "Please enter a valid year."})

        _qual_specs = [
            str(self.initial_data.get(k, "")).strip()
            for k in self.initial_data
            if k.startswith("qual_spec_")
        ] + [str(self.initial_data.get("qual_spec", "")).strip()]

        for _spec in _qual_specs:
            if not _spec:
                continue
            if len(_spec) < 2 or len(_spec) > 50:
                raise serializers.ValidationError({"qual_spec": "Specialisation must be 2–50 characters."})
            if not re.match(r"^[A-Za-z\s]+$", _spec):
                raise serializers.ValidationError({"qual_spec": "Specialisation: letters and spaces only."})
            if _is_gibberish_name(_spec):
                raise serializers.ValidationError({"qual_spec": "Specialisation contains repeated characters."})

        _qual_pcts = [
            str(self.initial_data.get(k, "")).strip()
            for k in self.initial_data
            if k.startswith("qual_pct_")
        ] + [str(self.initial_data.get("qual_pct", "")).strip()]

        for _pct in _qual_pcts:
            if not _pct:
                continue
            try:
                _pct_val = float(_pct)
            except ValueError:
                raise serializers.ValidationError({"qual_pct": "Please enter a valid Percentage or CGPA."})
            if len(_pct) > 5 or _pct_val < 0 or _pct_val > 100:
                raise serializers.ValidationError({"qual_pct": "Please enter a valid Percentage or CGPA."})

        # --- Teaching certifications ---
        _bed_reg = str(self.initial_data.get("bed_reg_no", "")).strip().upper()
        if _bed_reg:
            if len(_bed_reg) < 5 or len(_bed_reg) > 30:
                raise serializers.ValidationError({"bed_reg_no": "B.Ed Registration No. must be 5–30 characters."})
            if not re.match(r"^[A-Z0-9/\-]{5,30}$", _bed_reg):
                raise serializers.ValidationError({"bed_reg_no": "Enter a valid B.Ed Registration Number."})
            if not re.search(r"[A-Z]", _bed_reg):
                raise serializers.ValidationError({"bed_reg_no": "Enter a valid B.Ed Registration Number."})
            if re.match(r"^(.)\1+$", _bed_reg):
                raise serializers.ValidationError({"bed_reg_no": "Enter a valid B.Ed Registration Number."})

        _ctet = str(self.initial_data.get("ctet_score", "")).strip()
        if _ctet:
            if len(_ctet) > 7 or not re.fullmatch(r"\d{1,3}(/\d{1,3})?", _ctet):
                raise serializers.ValidationError({"ctet_score": "Please enter a valid CTET / STET score (e.g. 115 or 115/150)."})

        _subj_qual = str(self.initial_data.get("subjects_qualified", "")).strip()
        if _subj_qual:
            if len(_subj_qual) < 2 or len(_subj_qual) > 100:
                raise serializers.ValidationError({"subjects_qualified": "Subjects must be 2–100 characters."})
            if not re.match(r"^[A-Za-z,\s]+$", _subj_qual):
                raise serializers.ValidationError({"subjects_qualified": "Subjects: use letters, commas, and spaces only."})
            if _is_gibberish_name(_subj_qual):
                raise serializers.ValidationError({"subjects_qualified": "Subjects contains repeated characters."})

        # --- Previous employment rows ---
        _prev_employers = [
            str(self.initial_data.get(k, "")).strip()
            for k in self.initial_data
            if k.startswith("prev_employer_")
        ] + [str(self.initial_data.get("prev_employer", "")).strip()]

        for _emp in _prev_employers:
            if not _emp:
                continue
            if len(_emp) < 2 or len(_emp) > 100:
                raise serializers.ValidationError({"prev_employer": "Employer name must be 2–100 characters."})
            if not re.match(r"^[A-Za-z0-9\s.&'\-]+$", _emp):
                raise serializers.ValidationError({"prev_employer": "Enter a valid employer name."})
            if not re.search(r"[A-Za-z]", _emp):
                raise serializers.ValidationError({"prev_employer": "Enter a valid employer name."})
            if re.search(r"(.)\1{2,}", _emp, re.IGNORECASE):
                raise serializers.ValidationError({"prev_employer": "Enter a valid employer name."})
            if re.search(r"[bcdfghjklmnpqrstvwxyz]{5,}", _emp, re.IGNORECASE):
                raise serializers.ValidationError({"prev_employer": "Enter a valid employer name."})
            if re.search(r"(..)\1{2,}", _emp, re.IGNORECASE):
                raise serializers.ValidationError({"prev_employer": "Enter a valid employer name."})

        _prev_desigs = [
            str(self.initial_data.get(k, "")).strip()
            for k in self.initial_data
            if k.startswith("prev_designation_")
        ] + [str(self.initial_data.get("prev_designation", "")).strip()]

        for _des in _prev_desigs:
            if not _des:
                continue
            if len(_des) < 2 or len(_des) > 80:
                raise serializers.ValidationError({"prev_designation": "Designation must be 2–80 characters."})
            if not re.match(r"^[A-Za-z\s.&\-]+$", _des):
                raise serializers.ValidationError({"prev_designation": "Enter a valid designation."})
            if not re.search(r"[A-Za-z]", _des):
                raise serializers.ValidationError({"prev_designation": "Enter a valid designation."})
            if re.search(r"(.)\1{2,}", _des, re.IGNORECASE):
                raise serializers.ValidationError({"prev_designation": "Enter a valid designation."})
            if re.search(r"[bcdfghjklmnpqrstvwxyz]{5,}", _des, re.IGNORECASE):
                raise serializers.ValidationError({"prev_designation": "Enter a valid designation."})
            if re.search(r"(..)\1{2,}", _des, re.IGNORECASE):
                raise serializers.ValidationError({"prev_designation": "Enter a valid designation."})

        _prev_exps = [
            str(self.initial_data.get(k, "")).strip()
            for k in self.initial_data
            if k.startswith("prev_experience_")
        ] + [str(self.initial_data.get("prev_experience", "")).strip()]

        for _exp in _prev_exps:
            if not _exp:
                continue
            try:
                _exp_val = float(_exp)
            except ValueError:
                raise serializers.ValidationError({"prev_experience": "Enter a valid experience value."})
            if not re.fullmatch(r"\d+(\.\d)?", _exp) or _exp_val < 0 or _exp_val > 50:
                raise serializers.ValidationError({"prev_experience": "Experience must be between 0 and 50 years."})

        _prev_salaries = [
            str(self.initial_data.get(k, "")).strip()
            for k in self.initial_data
            if k.startswith("prev_salary_")
        ] + [str(self.initial_data.get("prev_salary", "")).strip()]

        for _sal in _prev_salaries:
            if not _sal:
                continue
            if not re.fullmatch(r"\d+(\.\d{1,2})?", _sal):
                raise serializers.ValidationError({"prev_salary": "Only numeric values are allowed."})
            _int_part = _sal.split(".")[0]
            if len(_int_part) > 8:
                raise serializers.ValidationError({"prev_salary": "Salary exceeds the maximum allowed value."})
            try:
                _sal_val = float(_sal)
            except ValueError:
                raise serializers.ValidationError({"prev_salary": "Enter a valid salary amount."})
            if _sal_val < 1:
                raise serializers.ValidationError({"prev_salary": "Enter a valid salary amount."})
            if _sal_val > 9999999:
                raise serializers.ValidationError({"prev_salary": "Salary exceeds the maximum allowed value."})
            if re.fullmatch(r"(\d)\1+(\.\1+)?", _sal):
                raise serializers.ValidationError({"prev_salary": "Salary cannot contain repeated digits only."})

        # Date range validation for previous employment
        from datetime import date as _date
        _today = today  # already defined above
        _joining = join_date  # already parsed above
        _dob = date_of_birth  # already parsed above
        _min_work_date = add_years_safe(_dob, 18) if _dob else None

        _from_keys = sorted(k for k in self.initial_data if k.startswith("prev_from_"))
        _to_keys   = sorted(k for k in self.initial_data if k.startswith("prev_to_"))
        _emp_keys  = sorted(k for k in self.initial_data if k.startswith("prev_employer_"))

        def _validate_prev_dates(from_str, to_str, employer_str):
            has_employer = bool(employer_str.strip())
            _from_dt = None
            _to_dt   = None
            if from_str:
                try:
                    _from_dt = _date.fromisoformat(from_str)
                except ValueError:
                    raise serializers.ValidationError({"prev_from": "Enter a valid From Date."})
            if to_str:
                try:
                    _to_dt = _date.fromisoformat(to_str)
                except ValueError:
                    raise serializers.ValidationError({"prev_to": "Enter a valid To Date."})

            if has_employer and not _from_dt:
                raise serializers.ValidationError({"prev_from": "From Date is required when Previous Employer is entered."})
            if has_employer and not _to_dt:
                raise serializers.ValidationError({"prev_to": "To Date is required when Previous Employer is entered."})
            if _from_dt and _from_dt > _today:
                raise serializers.ValidationError({"prev_from": "From Date cannot be a future date."})
            if _to_dt and _to_dt > _today:
                raise serializers.ValidationError({"prev_to": "To Date cannot be a future date."})
            if _from_dt and _to_dt and _to_dt < _from_dt:
                raise serializers.ValidationError({"prev_to": "To Date must be greater than or equal to From Date."})
            if _from_dt and _joining and _from_dt >= _joining:
                raise serializers.ValidationError({"prev_from": "Previous employment start date must be before Joining Date."})
            if _to_dt and _joining and _to_dt >= _joining:
                raise serializers.ValidationError({"prev_to": "Previous employment end date must be before Joining Date."})
            if _from_dt and _min_work_date and _from_dt < _min_work_date:
                raise serializers.ValidationError({"prev_from": "Employment start date is not valid based on employee age."})

        # Indexed rows
        for _fk, _tk, _ek in zip(
            _from_keys,
            _to_keys,
            _emp_keys if _emp_keys else [""] * len(_from_keys),
        ):
            _validate_prev_dates(
                str(self.initial_data.get(_fk, "")).strip(),
                str(self.initial_data.get(_tk, "")).strip(),
                str(self.initial_data.get(_ek, "")).strip() if _ek else "",
            )
        # Flat keys
        _validate_prev_dates(
            str(self.initial_data.get("prev_from", "")).strip(),
            str(self.initial_data.get("prev_to",   "")).strip(),
            str(self.initial_data.get("prev_employer", "")).strip(),
        )



        def is_valid_optional_url(value):
            if not value:
                return True
            # Keep URL optional, but enforce proper absolute URL when provided.
            return bool(re.fullmatch(r"https?://[^\s/$.?#].[^\s]*", value, re.IGNORECASE))

        if not is_valid_optional_url(facebook_url):
            raise serializers.ValidationError({"facebook_url": "Enter a valid URL"})
        if not is_valid_optional_url(twitter_url):
            raise serializers.ValidationError({"twitter_url": "Enter a valid URL"})
        if not is_valid_optional_url(linkedin_url):
            raise serializers.ValidationError({"linkedin_url": "Enter a valid URL"})
        if not is_valid_optional_url(instagram_url):
            raise serializers.ValidationError({"instagram_url": "Enter a valid URL"})

        def add_years_safe(value, years):
            # Handles leap-day birthdays (Feb 29 -> Feb 28 on non-leap years)
            try:
                return value.replace(year=value.year + years)
            except ValueError:
                return value.replace(month=2, day=28, year=value.year + years)

        if date_of_birth and date_of_birth > today:
            raise serializers.ValidationError({"date_of_birth": "Date of birth cannot be in the future."})
        if date_of_birth:
            eighteenth_birthday = add_years_safe(date_of_birth, min_age_years)
            latest_allowed_dob = add_years_safe(today, -max_age_years)
            if eighteenth_birthday > today:
                raise serializers.ValidationError({"date_of_birth": "Staff age must be at least 18 years."})
            if date_of_birth < latest_allowed_dob:
                raise serializers.ValidationError({"date_of_birth": "Please enter a valid date of birth. Age cannot exceed 70 years."})

        if join_date and join_date > today:
            raise serializers.ValidationError({"join_date": "Joining date cannot be a future date."})
        if date_of_birth and join_date and join_date < date_of_birth:
            raise serializers.ValidationError({"join_date": "Joining date cannot be earlier than date of birth."})
        if date_of_birth and join_date:
            eighteenth_birthday = add_years_safe(date_of_birth, min_age_years)
            if join_date < eighteenth_birthday:
                raise serializers.ValidationError(
                    {"join_date": "Staff must be at least 18 years old at the time of joining."}
                )

        if staff_photo:
            lowered = staff_photo.lower()
            if not (lowered.endswith(".jpg") or lowered.endswith(".jpeg") or lowered.endswith(".png")):
                raise serializers.ValidationError({"staff_photo": "Only JPG and PNG files are allowed."})

        for document_name in other_document_values:
            lowered_doc = document_name.lower()
            if not lowered_doc.endswith((".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png")):
                raise serializers.ValidationError({"other_document": "Signature upload must be PDF, DOC, DOCX, JPG, JPEG, or PNG."})

        if school_id and staff_no:
            duplicate_staff_qs = Staff.objects.filter(school_id=school_id, staff_no__iexact=staff_no)
            if self.instance:
                duplicate_staff_qs = duplicate_staff_qs.exclude(pk=self.instance.pk)
            if duplicate_staff_qs.exists():
                raise serializers.ValidationError({"staff_no": "Staff number already exists."})

        if school_id and email:
            duplicate_email_qs = Staff.objects.filter(school_id=school_id, email__iexact=email)
            if self.instance:
                duplicate_email_qs = duplicate_email_qs.exclude(pk=self.instance.pk)
            if duplicate_email_qs.exists():
                raise serializers.ValidationError({"email": "Email already exists."})

        if school_id and department and department.school_id != school_id:
            raise serializers.ValidationError({"department": "Selected department does not belong to your school."})
        if school_id and designation and designation.school_id != school_id:
            raise serializers.ValidationError({"designation": "Selected designation does not belong to your school."})
        if school_id and role and role.school_id and role.school_id != school_id:
            raise serializers.ValidationError({"role": "Selected role does not belong to your school."})
        if department and designation and designation.department_id != department.id:
            raise serializers.ValidationError({"designation": "Selected designation does not belong to selected department."})
        if school_id and user and user.school_id and user.school_id != school_id:
            raise serializers.ValidationError({"user": "Selected user does not belong to your school."})

        # ========== MEDICAL & FITNESS VALIDATION ==========
        def _med_is_all_same(v: str) -> bool:
            return bool(re.match(r"^([A-Za-z0-9])\1+$", v))

        _med_cert_no = str(self.initial_data.get("med_cert_no", "")).strip()
        if _med_cert_no:
            if len(_med_cert_no) < 5 or len(_med_cert_no) > 30:
                raise serializers.ValidationError({"med_cert_no": "Enter a valid Medical Fitness Certificate Number."})
            if not re.match(r"^[A-Za-z0-9/\-]+$", _med_cert_no):
                raise serializers.ValidationError({"med_cert_no": "Enter a valid Medical Fitness Certificate Number."})
            if not re.search(r"[A-Za-z]", _med_cert_no):
                raise serializers.ValidationError({"med_cert_no": "Enter a valid Medical Fitness Certificate Number."})
            if re.search(r"(.)\1{2,}", _med_cert_no, re.IGNORECASE):
                raise serializers.ValidationError({"med_cert_no": "Enter a valid Medical Fitness Certificate Number."})
            if _med_is_all_same(_med_cert_no):
                raise serializers.ValidationError({"med_cert_no": "Enter a valid Medical Fitness Certificate Number."})

        _med_exam_date_raw = str(self.initial_data.get("med_exam_date", "")).strip()
        _med_exam_dt = None
        if _med_exam_date_raw:
            try:
                _med_exam_dt = date.fromisoformat(_med_exam_date_raw)
            except ValueError:
                raise serializers.ValidationError({"med_exam_date": "Enter a valid medical examination date."})
            if _med_exam_dt > today:
                raise serializers.ValidationError({"med_exam_date": "Medical examination date cannot be in the future."})
            if date_of_birth:
                if _med_exam_dt < date_of_birth:
                    raise serializers.ValidationError({"med_exam_date": "Medical examination date cannot be before date of birth."})
                _exam_min_dt = add_years_safe(date_of_birth, 18)
                if _med_exam_dt < _exam_min_dt:
                    raise serializers.ValidationError({"med_exam_date": "Medical examination date must be after the employee's 18th birthday."})

        _cert_valid_till_raw = str(self.initial_data.get("cert_valid_till", "")).strip()
        if _cert_valid_till_raw:
            try:
                _cert_valid_till_dt = date.fromisoformat(_cert_valid_till_raw)
            except ValueError:
                raise serializers.ValidationError({"cert_valid_till": "Certificate validity date must be after the medical examination date."})
            if _med_exam_dt and _cert_valid_till_dt <= _med_exam_dt:
                raise serializers.ValidationError({"cert_valid_till": "Certificate validity date must be after the medical examination date."})

        _dl_med_date_raw = str(self.initial_data.get("dl_medical_exam", "")).strip()
        if _dl_med_date_raw:
            try:
                _dl_med_dt = date.fromisoformat(_dl_med_date_raw)
            except ValueError:
                raise serializers.ValidationError({"dl_medical_exam": "Last DL Medical Exam date is invalid."})
            if _dl_med_dt > today:
                raise serializers.ValidationError({"dl_medical_exam": "Last DL Medical Exam date is invalid."})
            if date_of_birth and _dl_med_dt < date_of_birth:
                raise serializers.ValidationError({"dl_medical_exam": "Last DL Medical Exam date is invalid."})
            if _med_exam_dt and _dl_med_dt < _med_exam_dt:
                raise serializers.ValidationError({"dl_medical_exam": "Last DL Medical Exam date is invalid."})

        _disab_cert_no = str(self.initial_data.get("disability_cert_no", "")).strip()
        if _disab_cert_no:
            if len(_disab_cert_no) < 5 or len(_disab_cert_no) > 30:
                raise serializers.ValidationError({"disability_cert_no": "Enter a valid Disability Certificate Number."})
            if not re.match(r"^[A-Za-z0-9/\-]+$", _disab_cert_no):
                raise serializers.ValidationError({"disability_cert_no": "Enter a valid Disability Certificate Number."})
            if not re.search(r"[A-Za-z]", _disab_cert_no):
                raise serializers.ValidationError({"disability_cert_no": "Enter a valid Disability Certificate Number."})
            if re.search(r"(.)\1{2,}", _disab_cert_no, re.IGNORECASE):
                raise serializers.ValidationError({"disability_cert_no": "Enter a valid Disability Certificate Number."})
            if _med_is_all_same(_disab_cert_no):
                raise serializers.ValidationError({"disability_cert_no": "Enter a valid Disability Certificate Number."})

        _disab_pct_raw = str(self.initial_data.get("disability_pct", "")).strip()
        if _disab_pct_raw:
            if not re.fullmatch(r"\d{1,3}", _disab_pct_raw):
                raise serializers.ValidationError({"disability_pct": "Disability percentage must be between 1 and 100."})
            _disab_pct_val = int(_disab_pct_raw)
            if _disab_pct_val < 1 or _disab_pct_val > 100:
                raise serializers.ValidationError({"disability_pct": "Disability percentage must be between 1 and 100."})

        _disab_authority = str(self.initial_data.get("disability_authority", "")).strip()
        if _disab_authority:
            if len(_disab_authority) < 2 or len(_disab_authority) > 100:
                raise serializers.ValidationError({"disability_authority": "Enter a valid issuing authority."})
            if not re.match(r"^[A-Za-z\s.'&\-]+$", _disab_authority):
                raise serializers.ValidationError({"disability_authority": "Enter a valid issuing authority."})
            if not re.search(r"[A-Za-z]", _disab_authority):
                raise serializers.ValidationError({"disability_authority": "Enter a valid issuing authority."})
            if re.search(r"(.)\1{2,}", _disab_authority, re.IGNORECASE):
                raise serializers.ValidationError({"disability_authority": "Enter a valid issuing authority."})
            if re.search(r"[bcdfghjklmnpqrstvwxyz]{5,}", _disab_authority, re.IGNORECASE):
                raise serializers.ValidationError({"disability_authority": "Enter a valid issuing authority."})
            if re.search(r"(..)\1{2,}", _disab_authority, re.IGNORECASE):
                raise serializers.ValidationError({"disability_authority": "Enter a valid issuing authority."})

        _accommodations = str(self.initial_data.get("workplace_accommodations", "")).strip()
        if _accommodations:
            if len(_accommodations) < 2 or len(_accommodations) > 250:
                raise serializers.ValidationError({"workplace_accommodations": "Enter valid accommodation details."})
            if not re.match(r"^[A-Za-z\s,.\-]+$", _accommodations):
                raise serializers.ValidationError({"workplace_accommodations": "Enter valid accommodation details."})
            if not re.search(r"[A-Za-z]", _accommodations):
                raise serializers.ValidationError({"workplace_accommodations": "Enter valid accommodation details."})
            if re.search(r"(.)\1{2,}", _accommodations, re.IGNORECASE):
                raise serializers.ValidationError({"workplace_accommodations": "Enter valid accommodation details."})
            if re.search(r"(..)\1{2,}", _accommodations, re.IGNORECASE):
                raise serializers.ValidationError({"workplace_accommodations": "Enter valid accommodation details."})

        _eye_exam = str(self.initial_data.get("eye_exam_result", "")).strip()
        if _eye_exam and _eye_exam not in {"Pass", "Fail"}:
            raise serializers.ValidationError({"eye_exam_result": "Select Pass or Fail."})

        # Cross-field: disability required fields
        _disab_status = str(self.initial_data.get("disability_status", "")).strip()
        if _disab_status and _disab_status not in ("", "None"):
            if not _disab_cert_no:
                raise serializers.ValidationError({"disability_cert_no": "Disability Certificate Number is required when disability status is set."})
            if not _disab_pct_raw:
                raise serializers.ValidationError({"disability_pct": "Disability Percentage is required when disability status is set."})
            if not _disab_authority:
                raise serializers.ValidationError({"disability_authority": "Issuing Authority is required when disability status is set."})

        return attrs


class LeaveTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveType
        fields = ["id", "school", "name", "max_days_per_year", "is_paid", "is_active", "created_at"]
        read_only_fields = ["id", "school", "created_at"]

    def validate_name(self, value):
        normalized = (value or "").strip()
        if not normalized:
            raise serializers.ValidationError("Leave name is required.")
        if len(normalized) < 3:
            raise serializers.ValidationError("Leave name must be at least 3 characters.")
        if not re.fullmatch(r"[A-Za-z ]+", normalized):
            raise serializers.ValidationError("Leave name can contain only letters and spaces.")

        request = self.context.get("request")
        school = getattr(getattr(request, "user", None), "school", None) or getattr(self.instance, "school", None)
        if school:
            duplicate_qs = LeaveType.objects.filter(school=school, name__iexact=normalized)
            if self.instance:
                duplicate_qs = duplicate_qs.exclude(pk=self.instance.pk)
            if duplicate_qs.exists():
                raise serializers.ValidationError("Leave type already exists.")

        return normalized

    def validate_max_days_per_year(self, value):
        if value is None:
            raise serializers.ValidationError("Max days is required.")
        if value <= 0:
            raise serializers.ValidationError("Max days must be greater than 0.")
        if value > 365:
            raise serializers.ValidationError("Max days cannot exceed 365.")
        return value

    def validate(self, attrs):
        is_paid = attrs.get("is_paid") if "is_paid" in attrs else getattr(self.instance, "is_paid", True)
        max_days = attrs.get("max_days_per_year") if "max_days_per_year" in attrs else getattr(self.instance, "max_days_per_year", 0)
        is_active = attrs.get("is_active") if "is_active" in attrs else getattr(self.instance, "is_active", True)

        if is_paid and (max_days is None or max_days <= 0):
            raise serializers.ValidationError({"max_days_per_year": "Paid leave must have max days greater than 0."})

        # Prevent deactivation when leave type is already in active business use.
        if self.instance and self.instance.is_active and not is_active:
            if self.instance.leave_defines.exists() or self.instance.leave_requests.exists():
                raise serializers.ValidationError({"is_active": "Cannot deactivate leave type that is already in use."})

        return attrs


class LeaveDefineSerializer(serializers.ModelSerializer):
    role = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(),
        required=False,
        allow_null=True,
        error_messages={
            "does_not_exist": "Role not found",
            "incorrect_type": "Role not found",
            "invalid": "Role not found",
        },
    )
    staff = serializers.PrimaryKeyRelatedField(
        queryset=Staff.objects.all(),
        required=False,
        allow_null=True,
        error_messages={
            "does_not_exist": "Staff not found",
            "incorrect_type": "Staff not found",
            "invalid": "Staff not found",
        },
    )
    student = serializers.PrimaryKeyRelatedField(
        queryset=Student.objects.all(),
        required=False,
        allow_null=True,
        error_messages={
            "does_not_exist": "Student not found",
            "incorrect_type": "Student not found",
            "invalid": "Student not found",
        },
    )
    school_class = serializers.PrimaryKeyRelatedField(
        queryset=SchoolClass.objects.all(),
        required=False,
        allow_null=True,
        error_messages={
            "does_not_exist": "Class not found",
            "incorrect_type": "Class not found",
            "invalid": "Class not found",
        },
    )
    section = serializers.PrimaryKeyRelatedField(
        queryset=Section.objects.all(),
        required=False,
        allow_null=True,
        error_messages={
            "does_not_exist": "Section not found",
            "incorrect_type": "Section not found",
            "invalid": "Section not found",
        },
    )
    leave_type = serializers.PrimaryKeyRelatedField(
        queryset=LeaveType.objects.all(),
        error_messages={
            "does_not_exist": "Leave type not found",
            "incorrect_type": "Leave type not found",
            "invalid": "Leave type not found",
        },
    )

    role_name = serializers.CharField(source="role.name", read_only=True)
    staff_name = serializers.SerializerMethodField(read_only=True)
    student_name = serializers.SerializerMethodField(read_only=True)
    class_name = serializers.CharField(source="school_class.name", read_only=True)
    section_name = serializers.CharField(source="section.name", read_only=True)
    leave_type_name = serializers.CharField(source="leave_type.name", read_only=True)

    class Meta:
        model = LeaveDefine
        fields = [
            "id",
            "school",
            "role",
            "role_name",
            "staff",
            "staff_name",
            "student",
            "student_name",
            "school_class",
            "class_name",
            "section",
            "section_name",
            "leave_type",
            "leave_type_name",
            "days",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "school",
            "created_at",
            "updated_at",
            "role_name",
            "staff_name",
            "student_name",
            "class_name",
            "section_name",
            "leave_type_name",
        ]

    def get_staff_name(self, obj):
        if not obj.staff_id:
            return ""
        return f"{(obj.staff.first_name or '').strip()} {(obj.staff.last_name or '').strip()}".strip()

    def get_student_name(self, obj):
        if not obj.student_id:
            return ""
        return f"{(obj.student.first_name or '').strip()} {(obj.student.last_name or '').strip()}".strip()

    def validate_days(self, value):
        if value is None:
            raise serializers.ValidationError("Days is required.")
        if int(value) <= 0:
            raise serializers.ValidationError("Days must be greater than 0")
        return int(value)

    def validate(self, attrs):
        request = self.context.get("request")
        school_id = request.user.school_id if request else None
        role = attrs.get("role") or getattr(self.instance, "role", None)
        staff = attrs.get("staff") or getattr(self.instance, "staff", None)
        student = attrs.get("student") or getattr(self.instance, "student", None)
        school_class = attrs.get("school_class") or getattr(self.instance, "school_class", None)
        section = attrs.get("section") or getattr(self.instance, "section", None)
        leave_type = attrs.get("leave_type") or getattr(self.instance, "leave_type", None)
        days = attrs.get("days") if "days" in attrs else getattr(self.instance, "days", None)
        is_student_role = bool(role and role.name and role.name.strip().lower() == "student")

        if not role and not staff:
            raise serializers.ValidationError({"role": "Select role or staff.", "staff": "Select role or staff."})
        if role and staff:
            raise serializers.ValidationError({"role": "Choose either role or staff, not both."})
        if is_student_role:
            if staff:
                raise serializers.ValidationError({"staff": "Staff selection is not allowed for Student role."})
            # Student is optional for student scope. If class is selected, section is mandatory.
            if school_class and not section:
                raise serializers.ValidationError({"section": "Section is required when class is selected."})
            if section and not school_class:
                raise serializers.ValidationError({"school_class": "Class is required when section is selected."})
            if student and (not school_class or not section):
                raise serializers.ValidationError({"student": "Select class and section before selecting a student."})
        else:
            if student:
                raise serializers.ValidationError({"student": "Student can be selected only when role is Student."})
            if school_class or section:
                raise serializers.ValidationError({"school_class": "Class/Section can be selected only when role is Student."})
        if days is None:
            raise serializers.ValidationError({"days": "Days is required."})
        if int(days) <= 0:
            raise serializers.ValidationError({"days": "Days must be greater than 0"})

        if school_id and role and role.school_id and role.school_id != school_id:
            raise serializers.ValidationError({"role": "Selected role does not belong to your school."})
        if school_id and staff and staff.school_id != school_id:
            raise serializers.ValidationError({"staff": "Selected staff does not belong to your school."})
        if school_id and student and student.school_id != school_id:
            raise serializers.ValidationError({"student": "Selected student does not belong to your school."})
        if school_id and school_class and school_class.school_id != school_id:
            raise serializers.ValidationError({"school_class": "Selected class does not belong to your school."})
        if school_id and section and section.school_class.school_id != school_id:
            raise serializers.ValidationError({"section": "Selected section does not belong to your school."})
        if school_class and section and section.school_class_id != school_class.id:
            raise serializers.ValidationError({"section": "Selected section does not belong to selected class."})
        if student and school_class and student.current_class_id != school_class.id:
            raise serializers.ValidationError({"student": "Selected student does not belong to selected class."})
        if student and section and student.current_section_id != section.id:
            raise serializers.ValidationError({"student": "Selected student does not belong to selected section."})
        if school_id and leave_type and leave_type.school_id != school_id:
            raise serializers.ValidationError({"leave_type": "Selected leave type does not belong to your school."})

        # Duplicate protection for student+leave_type, role+leave_type, or staff+leave_type.
        if school_id and leave_type:
            duplicate_qs = LeaveDefine.objects.filter(school_id=school_id, leave_type_id=leave_type.id)
            if is_student_role:
                duplicate_qs = duplicate_qs.filter(role_id=role.id)
                if student:
                    duplicate_qs = duplicate_qs.filter(student_id=student.id)
                elif school_class and section:
                    duplicate_qs = duplicate_qs.filter(school_class_id=school_class.id, section_id=section.id, student__isnull=True)
                else:
                    duplicate_qs = duplicate_qs.filter(
                        school_class__isnull=True,
                        section__isnull=True,
                        student__isnull=True,
                    )
            elif student:
                duplicate_qs = duplicate_qs.filter(student_id=student.id)
            elif staff:
                duplicate_qs = duplicate_qs.filter(staff_id=staff.id)
            elif role:
                duplicate_qs = duplicate_qs.filter(role_id=role.id)
            if self.instance:
                duplicate_qs = duplicate_qs.exclude(pk=self.instance.pk)
            if duplicate_qs.exists():
                if is_student_role and not student and school_class and section:
                    raise serializers.ValidationError({"section": "Leave already defined for this class/section and leave type."})
                if is_student_role and not student and not school_class and not section:
                    raise serializers.ValidationError({"role": "Leave already defined for all students and this leave type."})
                if student:
                    raise serializers.ValidationError({"student": "Leave already defined for this student and leave type."})
                if role and not staff:
                    raise serializers.ValidationError({"role": "Leave already defined for this role and leave type."})
                raise serializers.ValidationError({"staff": "Leave already defined for this staff and leave type."})

        return attrs


class LeaveRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveRequest
        fields = [
            "id",
            "school",
            "staff",
            "leave_type",
            "from_date",
            "to_date",
            "reason",
            "attachment",
            "approval_note",
            "status",
            "approved_by",
            "approved_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "school", "approved_by", "approved_at", "created_at", "updated_at"]
        extra_kwargs = {
            "staff": {"required": False},
            "leave_type": {"required": True},
            "from_date": {"required": True},
            "to_date": {"required": True},
        }

    def validate_leave_type(self, value):
        if not value:
            raise serializers.ValidationError("Leave type is required.")
        return value

    def validate_from_date(self, value):
        import datetime
        today = datetime.date.today()
        if value < today:
            raise serializers.ValidationError("From date cannot be in the past.")
        max_future = today + datetime.timedelta(days=180)  # 6 months
        if value > max_future:
            raise serializers.ValidationError("From date cannot be more than 6 months in the future.")
        return value

    def validate_reason(self, value):
        if value and value.strip():
            reason_length = len(value.strip())
            if reason_length < 20:
                raise serializers.ValidationError("Reason must be at least 20 characters if provided.")
            if reason_length > 500:
                raise serializers.ValidationError("Reason cannot exceed 500 characters.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        school_id = request.user.school_id if request else None
        
        # Get values, falling back to instance values if updating
        staff = attrs.get("staff") or getattr(self.instance, "staff", None)
        leave_type = attrs.get("leave_type") or getattr(self.instance, "leave_type", None)
        from_date = attrs.get("from_date") or getattr(self.instance, "from_date", None)
        to_date = attrs.get("to_date") or getattr(self.instance, "to_date", None)

        # Validate date range
        if from_date and to_date:
            if to_date < from_date:
                raise serializers.ValidationError({"to_date": "To date cannot be earlier than From date."})

        if leave_type and from_date and to_date:
            requested_days = (to_date - from_date).days + 1
            max_allowed = int(getattr(leave_type, "max_days_per_year", 0) or 0)
            if requested_days > max_allowed:
                raise serializers.ValidationError(
                    {"to_date": "Leave limit exceeded"}
                )
        
        # Validate school associations
        if school_id and staff and staff.school_id != school_id:
            raise serializers.ValidationError({"staff": "Selected staff member does not belong to your school."})
        if school_id and leave_type and leave_type.school_id != school_id:
            raise serializers.ValidationError({"leave_type": "Selected leave type does not belong to your school."})
        
        return attrs


class StaffAttendanceSerializer(serializers.ModelSerializer):
    staff_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = StaffAttendance
        fields = [
            "id",
            "school",
            "staff",
            "staff_name",
            "attendance_date",
            "attendance_type",
            "note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "school", "created_at", "updated_at", "staff_name"]

    def get_staff_name(self, obj):
        return f"{(obj.staff.first_name or '').strip()} {(obj.staff.last_name or '').strip()}".strip()

    def validate(self, attrs):
        request = self.context.get("request")
        school_id = request.user.school_id if request else None
        staff = attrs.get("staff") or getattr(self.instance, "staff", None)

        if school_id and staff and staff.school_id != school_id:
            raise serializers.ValidationError({"staff": "Selected staff does not belong to your school."})
        return attrs


class PayrollRecordSerializer(serializers.ModelSerializer):
    staff_name = serializers.SerializerMethodField(read_only=True)
    staff_no = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = PayrollRecord
        fields = [
            "id",
            "school",
            "staff",
            "staff_name",
            "staff_no",
            "payroll_month",
            "payroll_year",
            "basic_salary",
            "allowance",
            "allowance_items",
            "deduction",
            "deduction_items",
            "net_salary",
            "status",
            "paid_at",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "school", "net_salary", "created_by", "created_at", "updated_at"]

    def get_staff_name(self, obj):
        if not obj.staff:
            return ""
        return f"{(obj.staff.first_name or '').strip()} {(obj.staff.last_name or '').strip()}".strip()

    def get_staff_no(self, obj):
        return (obj.staff.staff_no or "") if obj.staff else ""

    def _normalize_component_items(self, value, field_name):
        if value in (None, ""):
            return [], Decimal("0.00")
        if not isinstance(value, list):
            raise serializers.ValidationError({field_name: "Component items must be a list."})

        cleaned_items = []
        total = Decimal("0.00")
        for item in value:
            if not isinstance(item, dict):
                raise serializers.ValidationError({field_name: "Each component must be an object."})

            label = str(item.get("label", "")).strip()
            raw_amount = item.get("amount", "0")
            try:
                amount = Decimal(str(raw_amount or "0"))
            except (InvalidOperation, TypeError, ValueError):
                raise serializers.ValidationError({field_name: "Component amount must be numeric."})

            if amount < 0:
                raise serializers.ValidationError({field_name: "Component amount cannot be negative."})

            if not label and amount == 0:
                continue

            cleaned_items.append({"label": label or "Component", "amount": str(amount.quantize(Decimal("0.01")) )})
            total += amount

        return cleaned_items, total.quantize(Decimal("0.01"))

    def validate(self, attrs):
        request = self.context.get("request")
        school_id = request.user.school_id if request else None
        staff = attrs.get("staff") or getattr(self.instance, "staff", None)
        basic_salary = attrs.get("basic_salary") if "basic_salary" in attrs else getattr(self.instance, "basic_salary", None)
        allowance = attrs.get("allowance") if "allowance" in attrs else getattr(self.instance, "allowance", None)
        deduction = attrs.get("deduction") if "deduction" in attrs else getattr(self.instance, "deduction", None)
        incoming_allowance_items = attrs.get("allowance_items", serializers.empty)
        incoming_deduction_items = attrs.get("deduction_items", serializers.empty)
        existing_allowance_items = getattr(self.instance, "allowance_items", []) if self.instance else []
        existing_deduction_items = getattr(self.instance, "deduction_items", []) if self.instance else []

        allowance_items_source = existing_allowance_items if incoming_allowance_items is serializers.empty else incoming_allowance_items
        deduction_items_source = existing_deduction_items if incoming_deduction_items is serializers.empty else incoming_deduction_items

        allowance_items, allowance_from_items = self._normalize_component_items(allowance_items_source, "allowance_items")
        deduction_items, deduction_from_items = self._normalize_component_items(deduction_items_source, "deduction_items")

        if allowance_items:
            allowance = allowance_from_items
        if deduction_items:
            deduction = deduction_from_items

        attrs["allowance_items"] = allowance_items
        attrs["deduction_items"] = deduction_items
        attrs["allowance"] = allowance
        attrs["deduction"] = deduction

        if school_id and staff and staff.school_id != school_id:
            raise serializers.ValidationError({"staff": "Selected staff member does not belong to your school."})

        try:
            basic_value = Decimal(str(basic_salary or 0))
            allowance_value = Decimal(str(allowance or 0))
            deduction_value = Decimal(str(deduction or 0))
        except (InvalidOperation, TypeError, ValueError):
            raise serializers.ValidationError({"deduction": "Enter valid salary values."})

        net_salary = basic_value + allowance_value - deduction_value
        if net_salary < 0:
            raise serializers.ValidationError({
                "deduction": "Deduction cannot be greater than basic salary plus allowance.",
            })
        return attrs


class PayrollSummarySerializer(serializers.Serializer):
    total_records = serializers.IntegerField()
    total_basic_salary = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_allowance = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_deduction = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_net_salary = serializers.DecimalField(max_digits=14, decimal_places=2)


class StaffOnboardDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaffOnboardDocument
        fields = ["id", "doc_key", "doc_label", "file_name", "file_size", "content_type", "status", "created_at"]
        read_only_fields = fields


class PayrollSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollSettings
        fields = [
            "id",
            "school",
            "school_name",
            "school_url",
            "logo_url",
            "signature_url",
            "default_allowance_items",
            "default_deduction_items",
            "default_allowance",
            "default_deduction",
            "updated_at",
        ]
        read_only_fields = ["id", "school", "default_allowance", "default_deduction", "updated_at"]

    def _normalize_component_items(self, value, field_name):
        if value in (None, ""):
            return [], Decimal("0.00")
        if not isinstance(value, list):
            raise serializers.ValidationError({field_name: "Component items must be a list."})

        cleaned_items = []
        total = Decimal("0.00")
        for item in value:
            if not isinstance(item, dict):
                raise serializers.ValidationError({field_name: "Each component must be an object."})

            label = str(item.get("label", "")).strip()
            raw_amount = item.get("amount", "0")
            try:
                amount = Decimal(str(raw_amount or "0"))
            except (InvalidOperation, TypeError, ValueError):
                raise serializers.ValidationError({field_name: "Component amount must be numeric."})

            if amount < 0:
                raise serializers.ValidationError({field_name: "Component amount cannot be negative."})

            if not label and amount == 0:
                continue

            cleaned_items.append({"label": label or "Component", "amount": str(amount.quantize(Decimal("0.01")) )})
            total += amount

        return cleaned_items, total.quantize(Decimal("0.01"))

    def validate(self, attrs):
        incoming_allowance_items = attrs.get("default_allowance_items", serializers.empty)
        incoming_deduction_items = attrs.get("default_deduction_items", serializers.empty)
        existing_allowance_items = getattr(self.instance, "default_allowance_items", []) if self.instance else []
        existing_deduction_items = getattr(self.instance, "default_deduction_items", []) if self.instance else []

        allowance_items_source = existing_allowance_items if incoming_allowance_items is serializers.empty else incoming_allowance_items
        deduction_items_source = existing_deduction_items if incoming_deduction_items is serializers.empty else incoming_deduction_items

        allowance_items, allowance_total = self._normalize_component_items(allowance_items_source, "default_allowance_items")
        deduction_items, deduction_total = self._normalize_component_items(deduction_items_source, "default_deduction_items")

        attrs["default_allowance_items"] = allowance_items
        attrs["default_deduction_items"] = deduction_items
        attrs["default_allowance"] = allowance_total
        attrs["default_deduction"] = deduction_total
        return attrs
