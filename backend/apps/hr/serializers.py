import json
from django.db.models import Sum
import re
from django.utils import timezone
from decimal import Decimal, InvalidOperation
from apps.access_control.models import Role
from apps.core.models import Class as SchoolClass, Section
from apps.students.models import Student
from rest_framework import serializers

from .models import Department, Designation, LeaveDefine, LeaveRequest, LeaveType, PayrollRecord, PayrollSettings, Staff, StaffAttendance, StaffDocument


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "school", "name", "description", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "school", "created_at", "updated_at"]
        extra_kwargs = {
            "name": {
                "error_messages": {
                    "required": "Department name is required.",
                }
            }
        }

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

    class Meta:
        model = Designation
        fields = ["id", "school", "department", "name", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "school", "created_at", "updated_at"]
        extra_kwargs = {
            "name": {
                "error_messages": {
                    "required": "Designation name is required.",
                }
            }
        }

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

        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]

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

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["other_document"] = self._normalize_other_documents(getattr(instance, "other_document", []))
        return data

    def to_internal_value(self, data):
        mutable_data = data.copy() if hasattr(data, "copy") else dict(data)
        if "other_document" in mutable_data:
            mutable_data["other_document"] = self._normalize_other_documents(mutable_data.get("other_document"))
        return super().to_internal_value(mutable_data)

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
        max_age_years = 80

        def get_value(field_name):
            if field_name in attrs:
                return attrs.get(field_name)
            return getattr(self.instance, field_name, None)

        department = get_value("department")
        designation = get_value("designation")
        user = get_value("user")
        role = get_value("role")
        staff_no = (get_value("staff_no") or "").strip()
        first_name = (get_value("first_name") or "").strip()
        email = (get_value("email") or "").strip().lower()
        phone = (get_value("phone") or "").strip()
        emergency_mobile = (get_value("emergency_mobile") or "").strip()
        date_of_birth = get_value("date_of_birth")
        join_date = get_value("join_date")
        staff_photo = (get_value("staff_photo") or "").strip()
        current_address = (get_value("current_address") or "").strip()
        permanent_address = (get_value("permanent_address") or "").strip()
        other_document = (get_value("other_document") or "").strip()
        epf_no = (get_value("epf_no") or "").strip()
        basic_salary = get_value("basic_salary")
        contract_type = (get_value("contract_type") or "").strip()
        bank_account_name = (get_value("bank_account_name") or "").strip()
        bank_account_no = (get_value("bank_account_no") or "").strip()
        bank_name = (get_value("bank_name") or "").strip()
        bank_branch = (get_value("bank_branch") or "").strip()
        facebook_url = (get_value("facebook_url") or "").strip()
        twitter_url = (get_value("twitter_url") or "").strip()
        linkedin_url = (get_value("linkedin_url") or "").strip()
        instagram_url = (get_value("instagram_url") or "").strip()

        required_errors = {}
        if not staff_no:
            required_errors["staff_no"] = "Staff no is required."
        if role is None:
            required_errors["role"] = "Role is required."
        if not first_name:
            required_errors["first_name"] = "First name is required."
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
        if not other_document:
            required_errors["other_document"] = "Signature upload is required."
        if not bank_account_name:
            required_errors["bank_account_name"] = "Account holder name is required."
        if not bank_account_no:
            required_errors["bank_account_no"] = "Enter valid account number"
        if not bank_name:
            required_errors["bank_name"] = "Bank name is required."
        if not bank_branch:
            required_errors["bank_branch"] = "Branch name is required."
        if basic_salary in (None, ""):
            required_errors["basic_salary"] = "Enter valid salary amount"
        if not contract_type:
            required_errors["contract_type"] = "Select contract type"
        if required_errors:
            raise serializers.ValidationError(required_errors)

        if email and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            raise serializers.ValidationError({"email": "Enter a valid email address."})

        mobile_pattern = re.compile(r"^\d{1,12}$")
        if phone and not mobile_pattern.fullmatch(phone):
            raise serializers.ValidationError({"phone": "Mobile number must contain digits only and must not exceed 12 digits."})
        if emergency_mobile and not mobile_pattern.fullmatch(emergency_mobile):
            raise serializers.ValidationError({"emergency_mobile": "Mobile number must contain digits only and must not exceed 12 digits."})
        bank_mobile_no = (get_value("bank_mobile_no") or "").strip()
        if bank_mobile_no and not mobile_pattern.fullmatch(bank_mobile_no):
            raise serializers.ValidationError({"bank_mobile_no": "Mobile number must contain digits only and must not exceed 12 digits."})

        # ========== BANK INFO VALIDATION ==========
        # Account Holder Name: Letters, spaces, and hyphens only - no special characters
        if bank_account_name and not re.match(r"^[A-Za-z\s\-']{2,120}$", bank_account_name):
            raise serializers.ValidationError({
                "bank_account_name": "Account holder name can contain only letters, spaces, hyphens, and apostrophes."
            })

        # Account Number: 6-30 digits, no special characters
        if bank_account_no and not re.fullmatch(r"\d{6,30}", bank_account_no):
            raise serializers.ValidationError({"bank_account_no": "Account number must be 6-30 digits."})

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

        # IFSC Code: Proper validation - 4 letters + 0 + 6 alphanumeric characters
        custom_field = get_value("custom_field") or {}
        ifsc_code = (custom_field.get("ifsc_code") or "").strip() if isinstance(custom_field, dict) else ""
        if ifsc_code:
            if not re.fullmatch(r"[A-Z]{4}0[A-Z0-9]{6}", ifsc_code.upper()):
                raise serializers.ValidationError({
                    "ifsc_code": "Invalid IFSC code format. Expected: 4 uppercase letters + 0 + 6 alphanumeric characters (e.g., HDFC0001234)."
                })

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
            raise serializers.ValidationError({"basic_salary": "Enter valid salary amount"})
        if salary_value <= 0:
            raise serializers.ValidationError({"basic_salary": "Enter valid salary amount"})

        if epf_no and not re.fullmatch(r"[A-Za-z0-9\-/]{4,30}", epf_no):
            raise serializers.ValidationError({"epf_no": "Enter a valid EPF number."})

        if contract_type and contract_type not in {"permanent", "contract"}:
            raise serializers.ValidationError({"contract_type": "Select contract type"})

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
                raise serializers.ValidationError({"date_of_birth": "Employee must be at least 18 years old."})
            if date_of_birth < latest_allowed_dob:
                raise serializers.ValidationError({"date_of_birth": f"Employee age should not exceed {max_age_years} years."})

        if join_date and join_date > today:
            raise serializers.ValidationError({"join_date": "Joining date cannot be in the future."})
        if date_of_birth and join_date and join_date < date_of_birth:
            raise serializers.ValidationError({"join_date": "Joining date cannot be earlier than date of birth."})
        if date_of_birth and join_date:
            eighteenth_birthday = add_years_safe(date_of_birth, min_age_years)
            if join_date < eighteenth_birthday:
                raise serializers.ValidationError(
                    {"join_date": f"Joining date must be after employee turns {min_age_years}."}
                )

        if staff_photo:
            lowered = staff_photo.lower()
            if not (lowered.endswith(".jpg") or lowered.endswith(".jpeg") or lowered.endswith(".png")):
                raise serializers.ValidationError({"staff_photo": "Only JPG and PNG files are allowed."})

        if other_document:
            lowered_doc = other_document.lower()
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
