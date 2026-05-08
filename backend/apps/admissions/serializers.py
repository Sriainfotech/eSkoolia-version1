import json
import re
from datetime import datetime, timedelta

from rest_framework import serializers
from django.utils import timezone
from django.utils.html import strip_tags

from apps.access_control.models import Role
from .models import (
    AdmissionFollowUp,
    AdmissionInquiry,
    AdminSetupEntry,
    CertificateTemplate,
    ComplaintEntry,
    IdCardTemplate,
    PhoneCallLogEntry,
    PostalDispatchEntry,
    PostalReceiveEntry,
    VisitorBookEntry,
)


PHONE_PATTERN = re.compile(r"^\d{10,12}$")
NAME_PATTERN = re.compile(r"^[A-Za-z\s\-']+$")
ALLOWED_VISITOR_FILE_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"}
MAX_VISITOR_FILE_SIZE = 5 * 1024 * 1024
ALLOWED_COMPLAINT_FILE_EXTENSIONS = {".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"}
MAX_COMPLAINT_FILE_SIZE = 5 * 1024 * 1024
ALLOWED_POSTAL_DISPATCH_FILE_EXTENSIONS = {".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".xlsx"}
MAX_POSTAL_DISPATCH_FILE_SIZE = 5 * 1024 * 1024


def _current_school_id(context, instance=None):
    request = context.get("request") if context else None
    if request and getattr(request, "user", None):
        user_school_id = getattr(request.user, "school_id", None)
        if user_school_id:
            return user_school_id
        request_school = getattr(request, "school", None)
        if request_school:
            return getattr(request_school, "id", None)
    if instance is not None:
        return getattr(getattr(instance, "school", None), "id", None)
    return None


def _normalize_duplicate_phone(value, field_name="phone", required=False):
    phone = str(value or "").strip()
    if not phone:
        if required:
            raise serializers.ValidationError({field_name: "This field is required."})
        return ""

    phone = re.sub(r"[\s-]", "", phone)
    if phone.startswith("+"):
        phone = phone[1:]

    if not re.fullmatch(r"\d{10,12}", phone):
        raise serializers.ValidationError({field_name: "Phone number must be 10 to 12 digits."})

    return phone


def _validate_duplicate_entry(model, filters, instance=None, message="Record already exists"):
    queryset = model.objects.filter(**filters)
    if instance is not None:
        queryset = queryset.exclude(id=instance.id)
    if queryset.exists():
        raise serializers.ValidationError(message)


class AdmissionPincodeLookupQuerySerializer(serializers.Serializer):
    pincode = serializers.CharField()

    def validate_pincode(self, value):
        pincode = str(value or "").strip()
        if not re.fullmatch(r"\d{6}", pincode):
            raise serializers.ValidationError("Pincode must be exactly 6 digits.")
        return pincode


def _sanitize_text(value):
    text = str(value or "")
    text = re.sub(r"<script.*?>.*?</script>", "", text, flags=re.IGNORECASE | re.DOTALL)
    return strip_tags(text).strip()


def _normalize_phone(value, field_name, required=False):
    phone = str(value or "").strip()
    if not phone:
        if required:
            raise serializers.ValidationError({field_name: "This field is required."})
        return ""

    phone = re.sub(r"[\s-]", "", phone)
    if phone.startswith("+"):
        phone = phone[1:]

    if not re.fullmatch(r"\d{10,12}", phone):
        raise serializers.ValidationError({field_name: "Phone number must be 10 to 12 digits."})

    return phone


def _parse_time_value(value):
    time_str = str(value or "").strip()
    if not time_str:
        return None

    for fmt in ("%H:%M", "%H:%M:%S", "%I:%M %p", "%I:%M:%S %p"):
        try:
            return datetime.strptime(time_str, fmt).time()
        except ValueError:
            continue
    return None


def _is_meaningful_text(value):
    text = str(value or "").strip()
    if not text:
        return True
    if not re.search(r"[A-Za-z]", text):
        return False
    if re.search(r"(.)\1{2,}", text):
        return False
    lowered = re.sub(r"\s+", "", text.lower())
    keyboard_patterns = ["qwerty", "asdf", "zxcv", "qazwsx", "poiuy", "lkjh", "mnbv", "abcdef", "abcd", "jkl"]
    if any(pattern in lowered for pattern in keyboard_patterns):
        return False
    if len(lowered) >= 2 and re.fullmatch(r"(.)\1+", lowered):
        return False
    return True


class AdmissionFollowUpSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = AdmissionFollowUp
        fields = ["id", "inquiry", "author", "author_name", "response", "note", "status_after", "created_at"]
        read_only_fields = ["id", "author", "author_name", "created_at"]

    def get_author_name(self, obj):
        if obj.author:
            return obj.author.get_full_name() or obj.author.username
        return None

    def validate(self, attrs):
        response = _sanitize_text(attrs.get("response", getattr(self.instance, "response", "")))
        note = _sanitize_text(attrs.get("note", getattr(self.instance, "note", "")))

        if not response:
            raise serializers.ValidationError({"response": "Response is required."})
        if len(response) < 2:
            raise serializers.ValidationError({"response": "Response must be at least 2 characters."})
        if len(response) > 500:
            raise serializers.ValidationError({"response": "Response must not exceed 500 characters."})
        if not _is_meaningful_text(response):
            raise serializers.ValidationError({"response": "Please enter a meaningful response."})
        if len(note) > 1000:
            raise serializers.ValidationError({"note": "Note must not exceed 1000 characters."})
        if note and not _is_meaningful_text(note):
            raise serializers.ValidationError({"note": "Please enter a meaningful note."})

        attrs["response"] = response
        attrs["note"] = note
        return super().validate(attrs)


class AdmissionFollowUpInlineSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = AdmissionFollowUp
        fields = ["id", "author_name", "response", "note", "status_after", "created_at"]

    def get_author_name(self, obj):
        if obj.author:
            return obj.author.get_full_name() or obj.author.username
        return None


class AdmissionInquirySerializer(serializers.ModelSerializer):
    follow_ups = AdmissionFollowUpInlineSerializer(many=True, read_only=True)
    source_name = serializers.CharField(source="source.name", read_only=True)
    reference_name = serializers.CharField(source="reference.name", read_only=True)
    class_name_resolved = serializers.CharField(source="school_class.name", read_only=True)
    created_by_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = AdmissionInquiry
        fields = [
            "id",
            "school",
            "full_name",
            "phone",
            "email",
            "address",
            "description",
            "query_date",
            "follow_up_date",
            "next_follow_up_date",
            "assigned",
            "reference",
            "reference_name",
            "source",
            "source_name",
            "school_class",
            "class_name_resolved",
            "no_of_child",
            "child_name",
            "has_sibling_enrolled",
            "sibling_name",
            "active_status",
            "created_by",
            "created_by_name",
            "class_name",
            "note",
            "status",
            "pipeline_stage",
            "lead_score",
            "last_contacted_at",
            "documents_status",
            "calendar_event_id",
            "follow_ups",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id", "school", "created_by", "created_by_name", "follow_ups",
            "last_contacted_at", "created_at", "updated_at",
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def validate(self, attrs):
        errors = {}

        def incoming_or_instance(field_name, default=""):
            if field_name in attrs:
                return attrs.get(field_name)
            if self.instance is not None:
                return getattr(self.instance, field_name, default)
            return default

        full_name = _sanitize_text(incoming_or_instance("full_name", ""))
        if not full_name:
            errors["full_name"] = "Name is required."
        elif len(full_name) < 2:
            errors["full_name"] = "Name must be at least 2 characters."
        elif len(full_name) > 100:
            errors["full_name"] = "Name must not exceed 100 characters."
        elif not NAME_PATTERN.match(full_name):
            errors["full_name"] = "Name can only contain letters, spaces, hyphens and apostrophes."
        elif not _is_meaningful_text(full_name):
            errors["full_name"] = "Please enter a meaningful name."

        query_date = incoming_or_instance("query_date", None)
        next_follow_up_date = incoming_or_instance("next_follow_up_date", None)
        follow_up_date = incoming_or_instance("follow_up_date", None)
        assigned = _sanitize_text(incoming_or_instance("assigned", ""))
        address = _sanitize_text(incoming_or_instance("address", ""))
        description = _sanitize_text(incoming_or_instance("description", ""))
        note = _sanitize_text(incoming_or_instance("note", ""))
        child_name = _sanitize_text(incoming_or_instance("child_name", ""))
        has_sibling_enrolled = _sanitize_text(incoming_or_instance("has_sibling_enrolled", ""))
        sibling_name = _sanitize_text(incoming_or_instance("sibling_name", ""))
        reference = incoming_or_instance("reference", None)
        source = incoming_or_instance("source", None)
        no_of_child_raw = incoming_or_instance("no_of_child", 1)

        # query_date and next_follow_up_date are optional; validate only if provided
        if query_date and query_date > timezone.localdate():
            errors["query_date"] = "Query date cannot be in the future."

        if next_follow_up_date and query_date and next_follow_up_date < query_date:
            errors["next_follow_up_date"] = "Follow-up date must be on or after the Query Date."

        if follow_up_date and next_follow_up_date and next_follow_up_date < follow_up_date:
            errors["next_follow_up_date"] = "Next follow-up date must be on or after last follow-up date."

        # assigned, reference, source, no_of_child are now optional
        if assigned and len(assigned) < 2:
            errors["assigned"] = "Name must be at least 2 characters."
        elif assigned and not _is_meaningful_text(assigned):
            errors["assigned"] = "Please enter a meaningful name."

        try:
            no_of_child = int(no_of_child_raw)
        except (TypeError, ValueError):
            no_of_child = 1
        if no_of_child < 1:
            errors["no_of_child"] = "Must be at least 1."
        elif no_of_child > 20:
            errors["no_of_child"] = "Cannot exceed 20."

        if address and not _is_meaningful_text(address):
            errors["address"] = "Please enter a meaningful address."
        if description and not _is_meaningful_text(description):
            errors["description"] = "Please enter a meaningful description."
        if note and not _is_meaningful_text(note):
            errors["note"] = "Please enter a meaningful note."

        phone = _normalize_phone(
            _sanitize_text(incoming_or_instance("phone", "")),
            "phone",
            required=True,
        )
        if not re.fullmatch(r"[6-9]\d{9}", phone):
            errors["phone"] = "Enter a valid 10-digit Indian mobile number starting with 6-9."

        if errors:
            raise serializers.ValidationError(errors)

        attrs["full_name"] = full_name
        attrs["phone"] = phone
        attrs["assigned"] = assigned
        attrs["address"] = address
        attrs["description"] = description
        attrs["note"] = note
        attrs["no_of_child"] = no_of_child
        attrs["child_name"] = child_name
        attrs["has_sibling_enrolled"] = has_sibling_enrolled
        attrs["sibling_name"] = sibling_name

        school_id = _current_school_id(self.context, self.instance)
        if school_id:
            class_value = incoming_or_instance("school_class", None)
            class_id = getattr(class_value, "id", None)
            if class_id is None and isinstance(class_value, (int, str)):
                class_str = str(class_value).strip()
                if class_str.isdigit():
                    class_id = int(class_str)

            request = self.context.get("request")
            restrict_same_day_duplicates = True
            if request is not None:
                raw_flag = request.data.get("restrict_same_day_duplicates", None)
                if raw_flag is None:
                    raw_flag = request.query_params.get("restrict_same_day_duplicates", None)
                if raw_flag is not None:
                    restrict_same_day_duplicates = str(raw_flag).strip().lower() in {"1", "true", "yes", "on"}

            duplicate_qs = AdmissionInquiry.objects.filter(
                school_id=school_id,
                full_name__iexact=full_name,
                phone=phone,
                school_class_id=class_id,
                no_of_child=no_of_child,
            )
            if self.instance is not None:
                duplicate_qs = duplicate_qs.exclude(id=self.instance.id)
            if restrict_same_day_duplicates:
                duplicate_qs = duplicate_qs.filter(created_at__date=timezone.localdate())

            if duplicate_qs.exists():
                raise serializers.ValidationError({"non_field_errors": ["This enquiry already exists"]})

        return super().validate(attrs)


class VisitorBookEntrySerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField(read_only=True)
    purpose_name = serializers.SerializerMethodField(read_only=True)
    file_upload = serializers.FileField(write_only=True, required=False, allow_null=True)
    file_url = serializers.SerializerMethodField(read_only=True)
    purpose = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = VisitorBookEntry
        fields = [
            "id",
            "school",
            "purpose",
            "purpose_name",
            "name",
            "phone",
            "visitor_id",
            "no_of_person",
            "date",
            "in_time",
            "out_time",
            "file_url",
            "file_upload",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "school", "visitor_id", "created_by", "created_by_name", "created_at", "updated_at"]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def _current_school_id(self):
        request = self.context.get("request")
        if not request or not getattr(request, "user", None):
            return None
        user_school_id = getattr(request.user, "school_id", None)
        if user_school_id:
            return user_school_id
        request_school = getattr(request, "school", None)
        return getattr(request_school, "id", None)

    def _resolve_purpose_name(self, purpose_value):
        if purpose_value is None:
            return ""

        raw = str(purpose_value).strip()
        if not raw:
            return ""

        if raw.isdigit():
            school_id = self._current_school_id()
            lookup = AdminSetupEntry.objects.filter(type="1", id=int(raw))
            if school_id:
                lookup = lookup.filter(school_id=school_id)
            purpose = lookup.only("name").first()
            if not purpose:
                raise serializers.ValidationError({"purpose": "Invalid purpose selected."})
            return purpose.name

        return raw

    def get_purpose_name(self, obj):
        try:
            return self._resolve_purpose_name(obj.purpose)
        except serializers.ValidationError:
            return str(obj.purpose or "")

    def validate(self, attrs):
        errors = {}

        is_partial = getattr(self, "partial", False)

        def _incoming_or_instance(field_name, default=""):
            if field_name in attrs:
                return attrs.get(field_name)
            if self.instance is not None:
                return getattr(self.instance, field_name, default)
            return default

        required_map = {
            "purpose": "Purpose is required.",
            "name": "Name is required.",
            "date": "Date is required.",
            "in_time": "In time is required.",
            "out_time": "Out time is required.",
            "no_of_person": "Enter a valid number of persons",
        }

        for field_name, message in required_map.items():
            if is_partial and field_name not in attrs:
                continue
            value = _incoming_or_instance(field_name)
            text = str(value or "").strip() if field_name != "date" else value
            if field_name == "date":
                if not text:
                    errors[field_name] = message
            elif not text:
                errors[field_name] = message

        if "purpose" in attrs:
            attrs["purpose"] = self._resolve_purpose_name(attrs.get("purpose"))

        name_value = _sanitize_text(_incoming_or_instance("name", ""))
        if "name" in attrs:
            attrs["name"] = name_value
        if name_value:
            if len(name_value) < 2 or len(name_value) > 100:
                errors["name"] = "Name must be between 2 and 100 characters."
            elif not NAME_PATTERN.match(name_value):
                errors["name"] = "Name must contain only letters, spaces, and hyphens"

        phone = _normalize_phone(
            _sanitize_text(_incoming_or_instance("phone", "")),
            "phone",
            required=False,
        )
        date_value = attrs.get("date", getattr(self.instance, "date", None))
        in_time_value = str(attrs.get("in_time", getattr(self.instance, "in_time", "")) or "").strip()
        out_time_value = str(attrs.get("out_time", getattr(self.instance, "out_time", "")) or "").strip()

        no_of_person = _incoming_or_instance("no_of_person", 0)
        try:
            person_count = int(no_of_person)
        except (TypeError, ValueError):
            person_count = 0
        if person_count < 1 or person_count > 99:
            errors["no_of_person"] = "Enter a valid number of persons"
        if "no_of_person" in attrs:
            attrs["no_of_person"] = person_count

        if "phone" in attrs:
            attrs["phone"] = phone

        if date_value and date_value > timezone.localdate():
            errors["date"] = "Date cannot be in the future."

        parsed_in_time = _parse_time_value(in_time_value)
        parsed_out_time = _parse_time_value(out_time_value)
        if in_time_value and parsed_in_time is None:
            errors["in_time"] = "Enter a valid in time."
        if out_time_value and parsed_out_time is None:
            errors["out_time"] = "Enter a valid out time."
        if parsed_in_time and parsed_out_time and parsed_out_time <= parsed_in_time:
            errors["out_time"] = "Out time must be after in time."

        upload = attrs.get("file_upload")
        if upload is not None:
            filename = str(getattr(upload, "name", "") or "").lower()
            extension = "." + filename.rsplit(".", 1)[1] if "." in filename else ""
            if extension not in ALLOWED_VISITOR_FILE_EXTENSIONS:
                errors["file_upload"] = "Unsupported file type. Allowed: PDF, JPG, PNG, DOC, DOCX."
            elif getattr(upload, "size", 0) > MAX_VISITOR_FILE_SIZE:
                errors["file_upload"] = "File size must be 5MB or less."

        if errors:
            raise serializers.ValidationError(errors)

        # Prevent duplicate visitor entries for the same phone, date, and in-time.
        if phone and date_value and in_time_value:
            school_id = self._current_school_id() or getattr(getattr(self.instance, "school", None), "id", None)
            queryset = VisitorBookEntry.objects.filter(phone=phone, date=date_value, in_time=in_time_value)
            if school_id:
                queryset = queryset.filter(school_id=school_id)
            if self.instance:
                queryset = queryset.exclude(id=self.instance.id)
            if queryset.exists():
                raise serializers.ValidationError("Record already exists")

        # Prevent duplicate visitor_id within the same school
        visitor_id = attrs.get("visitor_id", getattr(self.instance, "visitor_id", None))
        if visitor_id:
            school_id = self._current_school_id() or getattr(getattr(self.instance, "school", None), "id", None)
            queryset = VisitorBookEntry.objects.filter(visitor_id=visitor_id)
            if school_id:
                queryset = queryset.filter(school_id=school_id)
            if self.instance:
                queryset = queryset.exclude(id=self.instance.id)
            if queryset.exists():
                raise serializers.ValidationError({"visitor_id": "Visitor ID already exists."})

        return super().validate(attrs)

    def get_file_url(self, obj):
        if not obj.file_url:
            return ""
        request = self.context.get("request")
        url = obj.file_url.url
        return request.build_absolute_uri(url) if request else url

    def create(self, validated_data):
        upload = validated_data.pop("file_upload", None)
        if upload is not None:
            validated_data["file_url"] = upload
        return super().create(validated_data)

    def update(self, instance, validated_data):
        upload = validated_data.pop("file_upload", None)
        if upload is not None:
            validated_data["file_url"] = upload
        return super().update(instance, validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["purpose"] = self.get_purpose_name(instance)
        return data


class ComplaintEntrySerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField(read_only=True)
    complaint_type_name = serializers.SerializerMethodField(read_only=True)
    complaint_source_name = serializers.SerializerMethodField(read_only=True)
    complaint_type = serializers.CharField(write_only=True, required=False, allow_blank=True)
    complaint_source = serializers.CharField(write_only=True, required=False, allow_blank=True)
    file_upload = serializers.FileField(write_only=True, required=False, allow_null=True)
    file_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ComplaintEntry
        fields = [
            "id",
            "school",
            "complaint_by",
            "complaint_type",
            "complaint_type_name",
            "complaint_source",
            "complaint_source_name",
            "phone",
            "date",
            "action_taken",
            "assigned",
            "description",
            "file",
            "file_upload",
            "file_url",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "school", "file", "file_url", "created_by", "created_by_name", "created_at", "updated_at"]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def _current_school_id(self):
        request = self.context.get("request")
        if not request or not getattr(request, "user", None):
            return None
        user_school_id = getattr(request.user, "school_id", None)
        if user_school_id:
            return user_school_id
        request_school = getattr(request, "school", None)
        return getattr(request_school, "id", None)

    def _resolve_setup_name(self, value, setup_type, field_name):
        raw = str(value or "").strip()
        if not raw:
            return ""

        if raw.isdigit():
            school_id = self._current_school_id() or getattr(getattr(self.instance, "school", None), "id", None)
            queryset = AdminSetupEntry.objects.filter(type=setup_type, id=int(raw))
            if school_id:
                queryset = queryset.filter(school_id=school_id)
            setup = queryset.only("name").first()
            if setup:
                return setup.name
            raise serializers.ValidationError({field_name: f"Invalid {field_name.replace('_', ' ')} selected."})

        return raw

    def get_complaint_type_name(self, obj):
        try:
            return self._resolve_setup_name(obj.complaint_type, "2", "complaint_type")
        except serializers.ValidationError:
            return str(obj.complaint_type or "")

    def get_complaint_source_name(self, obj):
        try:
            return self._resolve_setup_name(obj.complaint_source, "3", "complaint_source")
        except serializers.ValidationError:
            return str(obj.complaint_source or "")

    def validate(self, attrs):
        errors = {}

        def incoming_or_instance(field_name, default=""):
            if field_name in attrs:
                return attrs.get(field_name)
            if self.instance is not None:
                return getattr(self.instance, field_name, default)
            return default

        if "complaint_type" in attrs:
            attrs["complaint_type"] = self._resolve_setup_name(attrs.get("complaint_type"), "2", "complaint_type")
        if "complaint_source" in attrs:
            attrs["complaint_source"] = self._resolve_setup_name(attrs.get("complaint_source"), "3", "complaint_source")

        complaint_by = _sanitize_text(incoming_or_instance("complaint_by", ""))
        action_taken = _sanitize_text(incoming_or_instance("action_taken", ""))
        assigned = _sanitize_text(incoming_or_instance("assigned", ""))
        description = _sanitize_text(incoming_or_instance("description", ""))
        date_value = incoming_or_instance("date", None)

        if not complaint_by:
            errors["complaint_by"] = "Complaint By is required."
        elif len(complaint_by) < 2:
            errors["complaint_by"] = "Minimum 2 characters required."
        elif len(complaint_by) > 100:
            errors["complaint_by"] = "Complaint By must not exceed 100 characters."
        elif not NAME_PATTERN.match(complaint_by):
            errors["complaint_by"] = "Only letters, spaces, hyphens, apostrophes allowed."
        elif not _is_meaningful_text(complaint_by):
            errors["complaint_by"] = "Please enter meaningful text."

        complaint_type_value = incoming_or_instance("complaint_type", "")
        complaint_source_value = incoming_or_instance("complaint_source", "")
        if not str(complaint_type_value or "").strip():
            errors["complaint_type"] = "Please select a complaint type."
        if not str(complaint_source_value or "").strip():
            errors["complaint_source"] = "Please select a complaint source."

        if not date_value:
            errors["date"] = "Please select a date."
        elif date_value > timezone.localdate():
            errors["date"] = "Date cannot be in the future."

        if action_taken and not _is_meaningful_text(action_taken):
            errors["action_taken"] = "Please enter meaningful text."
        if assigned and not _is_meaningful_text(assigned):
            errors["assigned"] = "Please enter a valid name."
        if description:
            if len(description) < 10:
                errors["description"] = "Description must be at least 10 characters."
            elif not _is_meaningful_text(description):
                errors["description"] = "Please enter meaningful text."

        upload = attrs.get("file_upload")
        if upload is not None:
            filename = str(getattr(upload, "name", "") or "").lower()
            extension = "." + filename.rsplit(".", 1)[1] if "." in filename else ""
            if extension not in ALLOWED_COMPLAINT_FILE_EXTENSIONS:
                errors["file_upload"] = "Invalid file type. Allowed: PDF, DOC, JPG, PNG."
            elif getattr(upload, "size", 0) > MAX_COMPLAINT_FILE_SIZE:
                errors["file_upload"] = "File size exceeds 5MB limit."

        phone = _normalize_phone(
            _sanitize_text(incoming_or_instance("phone", "")),
            "phone",
            required=False,
        )

        if errors:
            raise serializers.ValidationError(errors)

        attrs["complaint_by"] = complaint_by
        attrs["action_taken"] = action_taken
        attrs["assigned"] = assigned
        attrs["description"] = description
        attrs["phone"] = phone

        school_id = _current_school_id(self.context, self.instance)
        if school_id:
            duplicate_filters = {
                "school_id": school_id,
                "complaint_by__iexact": complaint_by,
                "complaint_type__iexact": str(complaint_type_value or "").strip(),
                "complaint_source__iexact": str(complaint_source_value or "").strip(),
                "phone": phone,
                "date": date_value,
                "action_taken__iexact": action_taken,
                "assigned__iexact": assigned,
                "description__iexact": description,
            }
            _validate_duplicate_entry(ComplaintEntry, duplicate_filters, instance=self.instance)

        return super().validate(attrs)

    def get_file_url(self, obj):
        if not obj.file:
            return ""
        request = self.context.get("request")
        url = obj.file.url
        return request.build_absolute_uri(url) if request else url

    def create(self, validated_data):
        upload = validated_data.pop("file_upload", None)
        if upload is not None:
            validated_data["file"] = upload
        return super().create(validated_data)

    def update(self, instance, validated_data):
        upload = validated_data.pop("file_upload", None)
        if upload is not None:
            validated_data["file"] = upload
        return super().update(instance, validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["complaint_type"] = self.get_complaint_type_name(instance)
        data["complaint_source"] = self.get_complaint_source_name(instance)
        return data


class PostalReceiveEntrySerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField(read_only=True)
    file_upload = serializers.FileField(write_only=True, required=False, allow_null=True)
    file_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = PostalReceiveEntry
        fields = [
            "id",
            "school",
            "from_title",
            "reference_no",
            "address",
            "note",
            "to_title",
            "date",
            "file",
            "file_upload",
            "file_url",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "school", "file", "file_url", "created_by", "created_by_name", "created_at", "updated_at"]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_file_url(self, obj):
        if not obj.file:
            return ""
        request = self.context.get("request")
        url = obj.file.url
        return request.build_absolute_uri(url) if request else url

    def create(self, validated_data):
        upload = validated_data.pop("file_upload", None)
        if upload is not None:
            validated_data["file"] = upload
        return super().create(validated_data)

    def update(self, instance, validated_data):
        upload = validated_data.pop("file_upload", None)
        if upload is not None:
            validated_data["file"] = upload
        return super().update(instance, validated_data)

    def validate(self, attrs):
        errors = {}

        def incoming_or_instance(field_name, default=""):
            if field_name in attrs:
                return attrs.get(field_name)
            if self.instance is not None:
                return getattr(self.instance, field_name, default)
            return default

        from_title = _sanitize_text(incoming_or_instance("from_title", ""))
        reference_no = _sanitize_text(incoming_or_instance("reference_no", ""))
        address = _sanitize_text(incoming_or_instance("address", ""))
        note = _sanitize_text(incoming_or_instance("note", ""))
        to_title = _sanitize_text(incoming_or_instance("to_title", ""))
        receive_date = incoming_or_instance("date", None)

        if not from_title:
            errors["from_title"] = "From Title is required."
        elif len(from_title) < 3:
            errors["from_title"] = "From Title must be at least 3 characters."
        elif not _is_meaningful_text(from_title):
            errors["from_title"] = "Please enter a meaningful From Title."

        if not reference_no:
            errors["reference_no"] = "Reference No is required."
        elif len(reference_no) < 3:
            errors["reference_no"] = "Reference No must be at least 3 characters."
        elif len(reference_no) > 20:
            errors["reference_no"] = "Reference No must not exceed 20 characters."
        elif not re.fullmatch(r"[A-Za-z0-9\-]+", reference_no):
            errors["reference_no"] = "Reference No must be alphanumeric (letters, numbers, hyphens only)."

        if not address:
            errors["address"] = "Address is required."
        elif len(address) < 5:
            errors["address"] = "Address must be at least 5 characters."

        if not to_title:
            errors["to_title"] = "To Title is required."
        elif len(to_title) < 3:
            errors["to_title"] = "To Title must be at least 3 characters."
        elif not _is_meaningful_text(to_title):
            errors["to_title"] = "Please enter a meaningful To Title."

        today = timezone.localdate()
        min_allowed = today - timedelta(days=365)
        if not receive_date:
            errors["date"] = "Receive Date is required."
        elif receive_date > today:
            errors["date"] = "Receive Date cannot be in the future."
        elif receive_date < min_allowed:
            errors["date"] = "Receive Date cannot be older than 1 year."

        if note and len(note) > 500:
            errors["note"] = "Note must not exceed 500 characters."

        if errors:
            raise serializers.ValidationError(errors)

        attrs["from_title"] = from_title
        attrs["reference_no"] = reference_no
        attrs["address"] = address
        attrs["note"] = note
        attrs["to_title"] = to_title

        attrs = super().validate(attrs)

        school_id = _current_school_id(self.context, self.instance)
        if school_id and reference_no:
            duplicate_filters = {
                "school_id": school_id,
                "reference_no__iexact": reference_no,
            }
            _validate_duplicate_entry(PostalReceiveEntry, duplicate_filters, instance=self.instance)

        return attrs


class PostalDispatchEntrySerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField(read_only=True)
    file_upload = serializers.FileField(write_only=True, required=False, allow_null=True)
    file_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = PostalDispatchEntry
        fields = [
            "id",
            "school",
            "from_title",
            "reference_no",
            "address",
            "note",
            "to_title",
            "date",
            "file",
            "file_upload",
            "file_url",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "school", "file", "file_url", "created_by", "created_by_name", "created_at", "updated_at"]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_file_url(self, obj):
        if not obj.file:
            return ""
        request = self.context.get("request")
        url = obj.file.url
        return request.build_absolute_uri(url) if request else url

    def _validate_fields(self, attrs):
        errors = {}

        def incoming_or_instance(field_name, default=""):
            if field_name in attrs:
                return attrs.get(field_name)
            if self.instance is not None:
                return getattr(self.instance, field_name, default)
            return default

        to_title = _sanitize_text(incoming_or_instance("to_title", ""))
        reference_no = _sanitize_text(incoming_or_instance("reference_no", ""))
        address = _sanitize_text(incoming_or_instance("address", ""))
        from_title = _sanitize_text(incoming_or_instance("from_title", ""))
        note = _sanitize_text(incoming_or_instance("note", ""))
        dispatch_date = incoming_or_instance("date", None)
        upload = attrs.get("file_upload")

        if not to_title:
            errors["to_title"] = "To Title is required."
        elif len(to_title) < 3:
            errors["to_title"] = "To Title must be at least 3 characters."
        elif not _is_meaningful_text(to_title):
            errors["to_title"] = "Please enter a meaningful To Title."

        if not reference_no:
            errors["reference_no"] = "Reference No is required."
        elif len(reference_no) < 3:
            errors["reference_no"] = "Reference No must be at least 3 characters."
        elif len(reference_no) > 20:
            errors["reference_no"] = "Reference No must not exceed 20 characters."
        elif not re.fullmatch(r"[A-Za-z0-9\-]+", reference_no):
            errors["reference_no"] = "Reference No must be alphanumeric (letters, numbers, hyphens only)."

        if not address:
            errors["address"] = "Address is required."
        elif len(address) < 5:
            errors["address"] = "Address must be at least 5 characters."

        if not from_title:
            errors["from_title"] = "From Title is required."
        elif len(from_title) < 3:
            errors["from_title"] = "From Title must be at least 3 characters."
        elif not _is_meaningful_text(from_title):
            errors["from_title"] = "Please enter a meaningful From Title."

        if note and len(note) > 500:
            errors["note"] = "Note must not exceed 500 characters."

        today = timezone.localdate()
        min_allowed = today - timedelta(days=365)
        if not dispatch_date:
            errors["date"] = "Dispatch Date is required."
        elif dispatch_date > today:
            errors["date"] = "Dispatch Date cannot be in the future."
        elif dispatch_date < min_allowed:
            errors["date"] = "Dispatch Date cannot be older than 1 year."

        if upload:
            file_name = str(getattr(upload, "name", "")).lower()
            extension = "." + file_name.rsplit(".", 1)[-1] if "." in file_name else ""
            if extension not in ALLOWED_POSTAL_DISPATCH_FILE_EXTENSIONS:
                errors["file_upload"] = "Invalid file type. Allowed: PDF, DOC, DOCX, JPG, PNG, XLSX."
            elif getattr(upload, "size", 0) > MAX_POSTAL_DISPATCH_FILE_SIZE:
                errors["file_upload"] = "File size exceeds 5MB limit."

        if errors:
            raise serializers.ValidationError(errors)

        attrs["to_title"] = to_title
        attrs["reference_no"] = reference_no
        attrs["address"] = address
        attrs["from_title"] = from_title
        attrs["note"] = note
        return attrs

    def create(self, validated_data):
        upload = validated_data.pop("file_upload", None)
        if upload is not None:
            validated_data["file"] = upload
        return super().create(validated_data)

    def update(self, instance, validated_data):
        upload = validated_data.pop("file_upload", None)
        if upload is not None:
            validated_data["file"] = upload
        return super().update(instance, validated_data)

    def validate(self, attrs):
        attrs = self._validate_fields(attrs)
        attrs = super().validate(attrs)

        school_id = _current_school_id(self.context, self.instance)
        if school_id:
            reference_no = _sanitize_text(attrs.get("reference_no", getattr(self.instance, "reference_no", "")))
            duplicate_filters = {
                "school_id": school_id,
                "reference_no__iexact": reference_no,
            }
            _validate_duplicate_entry(PostalDispatchEntry, duplicate_filters, instance=self.instance)

        return attrs


class PhoneCallLogEntrySerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = PhoneCallLogEntry
        fields = [
            "id",
            "school",
            "name",
            "phone",
            "date",
            "next_follow_up_date",
            "call_duration",
            "description",
            "call_type",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "school", "created_by", "created_by_name", "created_at", "updated_at"]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def validate(self, attrs):
        errors = {}

        def incoming_or_instance(field_name, default=""):
            if field_name in attrs:
                return attrs.get(field_name)
            if self.instance is not None:
                return getattr(self.instance, field_name, default)
            return default

        caller_name = _sanitize_text(incoming_or_instance("name", ""))
        description = _sanitize_text(incoming_or_instance("description", ""))
        call_duration = _sanitize_text(incoming_or_instance("call_duration", ""))
        from_date = incoming_or_instance("date", None)
        to_date = incoming_or_instance("next_follow_up_date", None)
        call_type = str(incoming_or_instance("call_type", "I") or "I").strip()

        if not caller_name:
            errors["name"] = "Name is required."
        elif len(caller_name) < 2:
            errors["name"] = "Name must be at least 2 characters."
        elif len(caller_name) > 100:
            errors["name"] = "Name must not exceed 100 characters."
        elif not re.fullmatch(r"[A-Za-z0-9\s\-'.,()]+", caller_name):
            errors["name"] = "Invalid characters in Name."
        elif not _is_meaningful_text(caller_name):
            errors["name"] = "Please enter a meaningful name."

        phone = _normalize_phone(
            attrs.get("phone", getattr(self.instance, "phone", "")),
            "phone",
            required=True,
        )

        if from_date and from_date > timezone.localdate():
            errors["date"] = "From Date cannot be in the future."

        if to_date:
            if to_date > timezone.localdate():
                errors["next_follow_up_date"] = "To Date cannot be in the future."
            elif from_date and to_date < from_date:
                errors["next_follow_up_date"] = "To Date cannot be before From Date."

        if call_duration:
            if len(call_duration) > 8:
                errors["call_duration"] = "Call Duration must not exceed 8 characters."
            elif not re.fullmatch(r"([0-9]{1,2}):([0-5][0-9]):([0-5][0-9])", call_duration):
                errors["call_duration"] = "Enter duration in HH:MM:SS format (e.g., 00:10:00)."

        if len(description) > 500:
            errors["description"] = "Description must not exceed 500 characters."

        if call_type not in {"I", "O"}:
            errors["call_type"] = "Call Type is invalid."

        if errors:
            raise serializers.ValidationError(errors)

        attrs["name"] = caller_name
        attrs["description"] = description
        attrs["call_duration"] = call_duration
        attrs["call_type"] = call_type
        attrs["phone"] = phone

        school_id = _current_school_id(self.context, self.instance)
        if school_id:
            duplicate_filters = {
                "school_id": school_id,
                "name__iexact": caller_name,
                "phone": phone,
                "date": from_date,
                "next_follow_up_date": to_date,
                "call_duration": call_duration,
                "description__iexact": description,
                "call_type": call_type,
            }
            _validate_duplicate_entry(PhoneCallLogEntry, duplicate_filters, instance=self.instance)

        return super().validate(attrs)


class AdminSetupEntrySerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField(read_only=True)
    type_name = serializers.CharField(source="get_type_display", read_only=True)

    class Meta:
        model = AdminSetupEntry
        fields = [
            "id",
            "school",
            "type",
            "type_name",
            "name",
            "description",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "school", "created_by", "created_by_name", "created_at", "updated_at"]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def _current_school_id(self):
        request = self.context.get("request")
        if not request or not getattr(request, "user", None):
            return None
        user_school_id = getattr(request.user, "school_id", None)
        if user_school_id:
            return user_school_id
        request_school = getattr(request, "school", None)
        return getattr(request_school, "id", None)

    def validate(self, attrs):
        setup_type = attrs.get("type", getattr(self.instance, "type", None))
        raw_name = str(attrs.get("name", getattr(self.instance, "name", "")) or "").strip()
        school_id = self._current_school_id() or getattr(getattr(self.instance, "school", None), "id", None)

        if raw_name:
            attrs["name"] = raw_name

        if setup_type and raw_name and school_id:
            # Check for duplicates: both case-insensitive and exact match
            duplicate_qs = AdminSetupEntry.objects.filter(
                school_id=school_id, 
                type=setup_type, 
                name__iexact=raw_name
            )
            if self.instance:
                duplicate_qs = duplicate_qs.exclude(id=self.instance.id)
            if duplicate_qs.exists():
                raise serializers.ValidationError({"name": "Record already exists"})

        return super().validate(attrs)


class IdCardTemplateSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField(read_only=True)
    applicable_role_names = serializers.SerializerMethodField(read_only=True)
    background_upload = serializers.FileField(write_only=True, required=False, allow_null=True)
    profile_upload = serializers.FileField(write_only=True, required=False, allow_null=True)
    logo_upload = serializers.FileField(write_only=True, required=False, allow_null=True)
    signature_upload = serializers.FileField(write_only=True, required=False, allow_null=True)
    background_url = serializers.SerializerMethodField(read_only=True)
    profile_url = serializers.SerializerMethodField(read_only=True)
    logo_url = serializers.SerializerMethodField(read_only=True)
    signature_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = IdCardTemplate
        fields = [
            "id",
            "school",
            "title",
            "page_layout_style",
            "applicable_role_ids",
            "applicable_role_names",
            "pl_width",
            "pl_height",
            "user_photo_style",
            "user_photo_width",
            "user_photo_height",
            "t_space",
            "b_space",
            "l_space",
            "r_space",
            "background_img",
            "profile_image",
            "logo",
            "signature",
            "background_upload",
            "profile_upload",
            "logo_upload",
            "signature_upload",
            "background_url",
            "profile_url",
            "logo_url",
            "signature_url",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "school",
            "background_img",
            "profile_image",
            "logo",
            "signature",
            "background_url",
            "profile_url",
            "logo_url",
            "signature_url",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_applicable_role_names(self, obj):
        role_ids = obj.applicable_role_ids or []
        if not role_ids:
            return []
        roles = Role.objects.filter(id__in=role_ids).values_list("name", flat=True)
        return list(roles)

    def _file_url(self, file_field):
        if not file_field:
            return ""
        request = self.context.get("request")
        url = file_field.url
        return request.build_absolute_uri(url) if request else url

    def get_background_url(self, obj):
        return self._file_url(obj.background_img)

    def get_profile_url(self, obj):
        return self._file_url(obj.profile_image)

    def get_logo_url(self, obj):
        return self._file_url(obj.logo)

    def get_signature_url(self, obj):
        return self._file_url(obj.signature)

    def validate(self, attrs):
        attrs = super().validate(attrs)

        title = str(attrs.get("title", getattr(self.instance, "title", "")) or "").strip()
        layout = str(attrs.get("page_layout_style", getattr(self.instance, "page_layout_style", "")) or "").strip()
        if title:
            attrs["title"] = title

        school_id = _current_school_id(self.context, self.instance)
        if school_id and title and layout:
            duplicate_filters = {
                "school_id": school_id,
                "title__iexact": title,
                "page_layout_style": layout,
            }
            _validate_duplicate_entry(
                IdCardTemplate,
                duplicate_filters,
                instance=self.instance,
                message="ID Card with this title and layout already exists",
            )

        return attrs

    def create(self, validated_data):
        raw_roles = validated_data.get("applicable_role_ids")
        if isinstance(raw_roles, str):
            try:
                validated_data["applicable_role_ids"] = json.loads(raw_roles)
            except json.JSONDecodeError:
                validated_data["applicable_role_ids"] = []
        bg = validated_data.pop("background_upload", None)
        profile = validated_data.pop("profile_upload", None)
        logo = validated_data.pop("logo_upload", None)
        sign = validated_data.pop("signature_upload", None)
        if bg is not None:
            validated_data["background_img"] = bg
        if profile is not None:
            validated_data["profile_image"] = profile
        if logo is not None:
            validated_data["logo"] = logo
        if sign is not None:
            validated_data["signature"] = sign
        return super().create(validated_data)

    def update(self, instance, validated_data):
        raw_roles = validated_data.get("applicable_role_ids")
        if isinstance(raw_roles, str):
            try:
                validated_data["applicable_role_ids"] = json.loads(raw_roles)
            except json.JSONDecodeError:
                validated_data["applicable_role_ids"] = instance.applicable_role_ids
        bg = validated_data.pop("background_upload", None)
        profile = validated_data.pop("profile_upload", None)
        logo = validated_data.pop("logo_upload", None)
        sign = validated_data.pop("signature_upload", None)
        if bg is not None:
            validated_data["background_img"] = bg
        if profile is not None:
            validated_data["profile_image"] = profile
        if logo is not None:
            validated_data["logo"] = logo
        if sign is not None:
            validated_data["signature"] = sign
        return super().update(instance, validated_data)


class CertificateTemplateSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField(read_only=True)
    applicable_role_name = serializers.SerializerMethodField(read_only=True)
    background_upload = serializers.FileField(write_only=True, required=False, allow_null=True)
    background_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = CertificateTemplate
        fields = [
            "id",
            "school",
            "type",
            "title",
            "applicable_role_id",
            "applicable_role_name",
            "background_height",
            "background_width",
            "padding_top",
            "padding_right",
            "padding_bottom",
            "pading_left",
            "body",
            "background_image",
            "background_upload",
            "background_url",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "school",
            "background_image",
            "background_url",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_applicable_role_name(self, obj):
        if not obj.applicable_role_id:
            return None
        return Role.objects.filter(id=obj.applicable_role_id).values_list("name", flat=True).first()

    def get_background_url(self, obj):
        if not obj.background_image:
            return ""
        request = self.context.get("request")
        url = obj.background_image.url
        return request.build_absolute_uri(url) if request else url

    def validate(self, attrs):
        attrs = super().validate(attrs)
        title = str(attrs.get("title", getattr(self.instance, "title", "")) or "").strip()
        if title:
            attrs["title"] = title

        school_id = _current_school_id(self.context, self.instance)
        if school_id and title:
            duplicate_filters = {
                "school_id": school_id,
                "title__iexact": title,
            }
            _validate_duplicate_entry(CertificateTemplate, duplicate_filters, instance=self.instance)

        return attrs


    def create(self, validated_data):
        bg = validated_data.pop("background_upload", None)
        if bg is not None:
            validated_data["background_image"] = bg
        return super().create(validated_data)

    def update(self, instance, validated_data):
        bg = validated_data.pop("background_upload", None)
        if bg is not None:
            validated_data["background_image"] = bg
        return super().update(instance, validated_data)


# ──────────────────────────────────────────────────────────────────────────────
# Command Center serializers
# ──────────────────────────────────────────────────────────────────────────────
from .models import (  # noqa: E402 – placed here to avoid circular import concerns
    AIMessageTemplate,
    AuditLog,
    BulkJob,
    ConsentLog,
    ContactLog,
    PipelineStage,
)


class PipelineStageSerializer(serializers.ModelSerializer):
    inquiry_count = serializers.SerializerMethodField()

    class Meta:
        model = PipelineStage
        fields = ["id", "name", "slug", "order", "color", "is_active", "inquiry_count", "created_at"]
        read_only_fields = ["id", "created_at"]

    def get_inquiry_count(self, obj):
        return obj.inquiries.count()


class ContactLogSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ContactLog
        fields = [
            "id", "inquiry", "channel", "direction", "status",
            "provider_message_id", "call_session_id", "call_url",
            "subject", "body", "template_id",
            "performed_by", "performed_by_name", "created_at",
        ]
        read_only_fields = ["id", "performed_by", "performed_by_name", "created_at"]

    def get_performed_by_name(self, obj):
        if obj.performed_by:
            return obj.performed_by.get_full_name() or obj.performed_by.username
        return None


class ConsentLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConsentLog
        fields = ["id", "inquiry", "channel", "consent", "ip_address", "user_agent", "recorded_by", "created_at"]
        read_only_fields = ["id", "ip_address", "user_agent", "recorded_by", "created_at"]


class BulkJobSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    progress_pct = serializers.SerializerMethodField()

    class Meta:
        model = BulkJob
        fields = [
            "id", "action", "lead_ids", "payload",
            "status", "total", "processed", "failed", "error_detail",
            "celery_task_id", "created_by", "created_by_name",
            "progress_pct", "started_at", "finished_at", "created_at",
        ]
        read_only_fields = [
            "id", "status", "total", "processed", "failed", "error_detail",
            "celery_task_id", "created_by", "created_by_name",
            "progress_pct", "started_at", "finished_at", "created_at",
        ]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_progress_pct(self, obj):
        if not obj.total:
            return 0
        return round((obj.processed / obj.total) * 100, 1)


class AIMessageTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIMessageTemplate
        fields = [
            "id", "school", "name", "system_prompt", "user_prompt_template",
            "channel", "is_active", "created_by", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "school", "created_by", "created_at", "updated_at"]


class AIGenerateRequestSerializer(serializers.Serializer):
    lead_id = serializers.IntegerField()
    template_id = serializers.IntegerField(required=False)
    next_step = serializers.CharField(required=False, default="schedule campus visit")
    tone_preferences = serializers.DictField(required=False, default=dict)


class AIGenerateResponseSerializer(serializers.Serializer):
    variant_a = serializers.CharField()
    variant_b = serializers.CharField()
    prompt_used = serializers.CharField()

