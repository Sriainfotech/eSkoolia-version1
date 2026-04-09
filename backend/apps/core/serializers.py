import re
from rest_framework import serializers
from .models import (
    AcademicYear, Class, ClassPeriod, ClassRoom, Section, Subject, 
    Vehicle, TransportRoute, AssignVehicle,
    BusStop, BusLocation, TransportAlert, BusRoutePickupUpdate,
    ItemCategory, ItemStore, Supplier, Item, ItemReceive, ItemReceiveChild,
    ItemIssue, ItemSell, ItemSellChild
)


class AcademicYearSerializer(serializers.ModelSerializer):
    YEAR_NAME_REGEX = re.compile(r"^\d{4}-\d{4}$")
    MIN_DURATION_DAYS = 270  # ~9 months

    def _school_id(self):
        request = self.context.get("request")
        if self.instance and self.instance.school_id:
            return self.instance.school_id
        if request and getattr(request.user, "school_id", None):
            return request.user.school_id
        return None

    def _raise_validation(self, errors: dict):
        raise serializers.ValidationError(errors)

    def validate(self, attrs):
        attrs = super().validate(attrs)

        start_date = attrs.get("start_date") or getattr(self.instance, "start_date", None)
        end_date = attrs.get("end_date") or getattr(self.instance, "end_date", None)
        provided_name = (attrs.get("name") or "").strip()
        school_id = self._school_id()

        errors: dict[str, list[str]] = {}

        if not start_date:
            errors.setdefault("start_date", []).append("Start date is required.")
        if not end_date:
            errors.setdefault("end_date", []).append("End date is required.")

        generated_name = None
        if start_date and end_date:
            if start_date >= end_date:
                errors.setdefault("date", []).append("Start date must be before end date.")

            duration_days = (end_date - start_date).days
            if duration_days < self.MIN_DURATION_DAYS:
                errors.setdefault("date", []).append("Academic year must be at least 9 months long.")

            # School ERP standard: one academic year should cross into the next calendar year.
            if end_date.year != start_date.year + 1:
                errors.setdefault("date", []).append("Academic year must span across two consecutive calendar years.")

            generated_name = f"{start_date.year}-{end_date.year}"
            if not self.YEAR_NAME_REGEX.fullmatch(generated_name):
                errors.setdefault("year_name", []).append("Academic year must be in format YYYY-YYYY.")

            if provided_name and provided_name != generated_name:
                errors.setdefault("year_name", []).append(
                    f"Academic year name must match selected dates ({generated_name})."
                )

        if school_id and generated_name:
            duplicate_qs = AcademicYear.objects.filter(school_id=school_id, name=generated_name)
            if self.instance:
                duplicate_qs = duplicate_qs.exclude(pk=self.instance.pk)
            if duplicate_qs.exists():
                errors.setdefault("year_name", []).append("Academic year already exists")

            overlap_qs = AcademicYear.objects.filter(
                school_id=school_id,
                start_date__lte=end_date,
                end_date__gte=start_date,
            )
            if self.instance:
                overlap_qs = overlap_qs.exclude(pk=self.instance.pk)
            if overlap_qs.exists():
                errors.setdefault("date", []).append("Academic year date range overlaps an existing academic year.")

        if errors:
            self._raise_validation(errors)

        # Enforce ERP naming convention from date range (server-side source of truth).
        if generated_name:
            attrs["name"] = generated_name

        return attrs

    class Meta:
        model = AcademicYear
        fields = ["id", "school", "name", "start_date", "end_date", "is_current", "created_at", "updated_at"]
        read_only_fields = ["id", "school", "created_at", "updated_at"]


class SectionSerializer(serializers.ModelSerializer):
    NAME_REGEX = re.compile(r"^[A-Za-z0-9 ]+$")
    MAX_CAPACITY = 200
    MIN_CAPACITY = 1
    MAX_SECTIONS_PER_CLASS = 26

    def validate_name(self, value):
        cleaned = (value or "").strip()
        if not cleaned:
            raise serializers.ValidationError("Section name is required.")
        if not self.NAME_REGEX.fullmatch(cleaned):
            raise serializers.ValidationError("Section name can contain only alphanumeric characters.")
        return cleaned

    def validate(self, attrs):
        attrs = super().validate(attrs)

        school_class = attrs.get("school_class") or getattr(self.instance, "school_class", None)
        name = (attrs.get("name") or getattr(self.instance, "name", "") or "").strip()
        capacity = attrs.get("capacity", getattr(self.instance, "capacity", None))

        if capacity in (None, ""):
            raise serializers.ValidationError({"capacity": "Enter valid section capacity"})
        try:
            capacity_value = int(capacity)
        except (TypeError, ValueError):
            raise serializers.ValidationError({"capacity": "Enter valid section capacity"})

        if capacity_value < self.MIN_CAPACITY or capacity_value > self.MAX_CAPACITY:
            raise serializers.ValidationError({"capacity": "Enter valid section capacity"})
        attrs["capacity"] = capacity_value

        # Updates should always target one normalized section value.
        if self.instance is not None and "," in name:
            raise serializers.ValidationError({"name": "Update supports one section at a time. Use comma input only while adding sections."})

        if school_class and name:
            qs = Section.objects.filter(school_class=school_class, name__iexact=name)
            if self.instance is not None:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"name": "Section name already exists"})

        if school_class and self.instance is None:
            current_count = Section.objects.filter(school_class=school_class).count()
            if current_count >= self.MAX_SECTIONS_PER_CLASS:
                raise serializers.ValidationError({"name": "Section limit reached for this class."})

        return attrs

    class Meta:
        model = Section
        fields = ["id", "school_class", "name", "capacity", "created_at"]
        read_only_fields = ["id", "created_at"]


class ClassSerializer(serializers.ModelSerializer):
    sections = SectionSerializer(many=True, read_only=True)

    def _school_id(self):
        request = self.context.get("request")
        if self.instance and self.instance.school_id:
            return self.instance.school_id
        if request and getattr(request.user, "school_id", None):
            return request.user.school_id
        return None

    def validate_name(self, value):
        cleaned = (value or "").strip()

        school_id = self._school_id()
        if school_id and cleaned:
            duplicate_qs = Class.objects.filter(school_id=school_id, name__iexact=cleaned)
            if self.instance is not None:
                duplicate_qs = duplicate_qs.exclude(pk=self.instance.pk)
            if duplicate_qs.exists():
                raise serializers.ValidationError("Class name already exists")

        return cleaned

    def validate_numeric_order(self, value):
        return value

    class Meta:
        model = Class
        fields = ["id", "school", "name", "numeric_order", "sections", "created_at"]
        read_only_fields = ["id", "school", "sections", "created_at"]


class SubjectSerializer(serializers.ModelSerializer):
    SUBJECT_NAME_REGEX = re.compile(r"^[A-Za-z ]+$")
    SUBJECT_CODE_REGEX = re.compile(r"^[A-Za-z0-9]+$")

    def _school_id(self):
        request = self.context.get("request")
        if self.instance and self.instance.school_id:
            return self.instance.school_id
        if request and getattr(request.user, "school_id", None):
            return request.user.school_id
        return None

    def _raise_validation(self, errors: dict):
        raise serializers.ValidationError(errors)

    def validate(self, attrs):
        attrs = super().validate(attrs)

        school_id = self._school_id()
        raw_name = attrs.get("name", getattr(self.instance, "name", ""))
        raw_code = attrs.get("code", getattr(self.instance, "code", ""))
        raw_subject_type = attrs.get("subject_type", getattr(self.instance, "subject_type", ""))

        name = (raw_name or "").strip()
        code = (raw_code or "").strip().upper()
        subject_type = (raw_subject_type or "").strip().lower()

        errors: dict[str, list[str]] = {}

        # Name rules: required, >=2 chars, letters+spaces only, unique (case-insensitive).
        if not name:
            errors.setdefault("name", []).append("Subject name is required.")
        elif len(name) < 2:
            errors.setdefault("name", []).append("Subject name must be at least 2 characters.")
        elif not self.SUBJECT_NAME_REGEX.fullmatch(name):
            errors.setdefault("name", []).append("Subject name can contain only letters and spaces.")

        # Code rules: required, alphanumeric, 3-10 chars, unique.
        if not code:
            errors.setdefault("code", []).append("Subject code is required.")
        elif not self.SUBJECT_CODE_REGEX.fullmatch(code):
            errors.setdefault("code", []).append("Subject code must be alphanumeric.")
        elif len(code) < 3 or len(code) > 10:
            errors.setdefault("code", []).append("Subject code length must be between 3 and 10 characters.")

        # Type rules: Compulsory, Optional, or Elective.
        if subject_type not in {"compulsory", "optional", "elective"}:
            errors.setdefault("subject_type", []).append("Subject type must be Compulsory, Optional, or Elective.")

        if school_id and name:
            name_qs = Subject.objects.filter(school_id=school_id, name__iexact=name)
            if self.instance is not None:
                name_qs = name_qs.exclude(pk=self.instance.pk)
            if name_qs.exists():
                errors.setdefault("name", []).append("Subject name already exists.")

        if school_id and code:
            code_qs = Subject.objects.filter(school_id=school_id, code__iexact=code)
            if self.instance is not None:
                code_qs = code_qs.exclude(pk=self.instance.pk)
            if code_qs.exists():
                errors.setdefault("code", []).append("Subject code already exists.")

        if errors:
            self._raise_validation(errors)

        attrs["name"] = name
        attrs["code"] = code
        attrs["subject_type"] = subject_type
        return attrs

    class Meta:
        model = Subject
        fields = ["id", "school", "name", "code", "subject_type", "created_at"]
        read_only_fields = ["id", "school", "created_at"]


class ClassPeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassPeriod
        fields = ["id", "school", "period", "start_time", "end_time", "period_type", "is_break", "created_at", "updated_at"]
        read_only_fields = ["id", "school", "created_at", "updated_at"]


class ClassRoomSerializer(serializers.ModelSerializer):
    ROOM_NO_REGEX = re.compile(r"^[A-Z0-9][A-Z0-9\- ]{0,49}$")

    def _school_id(self):
        request = self.context.get("request")
        if self.instance and self.instance.school_id:
            return self.instance.school_id
        if request and getattr(request.user, "school_id", None):
            return request.user.school_id
        return None

    def validate(self, attrs):
        attrs = super().validate(attrs)

        room_no_raw = attrs.get("room_no", getattr(self.instance, "room_no", ""))
        room_no = (room_no_raw or "").strip().upper()
        capacity = attrs.get("capacity", getattr(self.instance, "capacity", None))

        errors = {}

        if not room_no:
            errors.setdefault("room_no", []).append("Room no is required")
        elif not self.ROOM_NO_REGEX.fullmatch(room_no):
            errors.setdefault("room_no", []).append("Enter a valid room number.")

        if capacity in (None, ""):
            errors.setdefault("capacity", []).append("Capacity is required")
        else:
            try:
                capacity_value = int(capacity)
            except (TypeError, ValueError):
                errors.setdefault("message", []).append("Capacity must be numeric")
            else:
                if capacity_value <= 0:
                    errors.setdefault("message", []).append("Capacity must be greater than zero")
                if capacity_value > 200:
                    errors.setdefault("capacity", []).append("Capacity must not exceed 200")
                attrs["capacity"] = capacity_value

        school_id = self._school_id()
        if school_id and room_no:
            duplicate_qs = ClassRoom.objects.filter(school_id=school_id, room_no__iexact=room_no)
            if self.instance is not None:
                duplicate_qs = duplicate_qs.exclude(pk=self.instance.pk)
            if duplicate_qs.exists():
                errors.setdefault("message", []).append("Room already exists")

        if errors:
            raise serializers.ValidationError(errors)

        attrs["room_no"] = room_no
        return attrs

    class Meta:
        model = ClassRoom
        fields = ["id", "school", "room_no", "capacity", "active_status", "created_at", "updated_at"]
        read_only_fields = ["id", "school", "created_at", "updated_at"]


# ===== TRANSPORT MODULE SERIALIZERS =====
class VehicleSerializer(serializers.ModelSerializer):
    driver_name = serializers.SerializerMethodField()

    def get_driver_name(self, obj):
        if obj.driver:
            return f"{obj.driver.first_name} {obj.driver.last_name}".strip()
        return None

    class Meta:
        model = Vehicle
        fields = ["id", "school", "academic_year", "vehicle_no", "vehicle_model", "made_year", "note", "driver", "driver_name", "active_status", "created_at", "updated_at"]
        read_only_fields = ["id", "school", "academic_year", "created_at", "updated_at"]


class TransportRouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransportRoute
        fields = ["id", "school", "academic_year", "title", "fare", "active_status", "created_at", "updated_at"]
        read_only_fields = ["id", "school", "academic_year", "created_at", "updated_at"]


class AssignVehicleSerializer(serializers.ModelSerializer):
    vehicle_no = serializers.CharField(source="vehicle.vehicle_no", read_only=True)
    route_title = serializers.CharField(source="route.title", read_only=True)

    class Meta:
        model = AssignVehicle
        fields = ["id", "school", "academic_year", "vehicle", "vehicle_no", "route", "route_title", "active_status", "created_at", "updated_at"]
        read_only_fields = ["id", "school", "academic_year", "created_at", "updated_at"]


# ===== BUS TRACKING MODULE SERIALIZERS =====
class BusStopSerializer(serializers.ModelSerializer):
    route_title = serializers.CharField(source="route.title", read_only=True)

    class Meta:
        model = BusStop
        fields = ["id", "route", "route_title", "stop_name", "latitude", "longitude", "stop_order", "arrival_time_window", "active_status", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class BusLocationSerializer(serializers.ModelSerializer):
    vehicle_no = serializers.CharField(source="vehicle.vehicle_no", read_only=True)

    class Meta:
        model = BusLocation
        fields = ["id", "vehicle", "vehicle_no", "latitude", "longitude", "speed", "heading", "accuracy", "timestamp", "is_active"]
        read_only_fields = ["id", "timestamp"]


class TransportAlertSerializer(serializers.ModelSerializer):
    vehicle_no = serializers.CharField(source="vehicle.vehicle_no", read_only=True)
    route_title = serializers.CharField(source="route.title", read_only=True, allow_null=True)

    class Meta:
        model = TransportAlert
        fields = ["id", "vehicle", "vehicle_no", "route", "route_title", "alert_type", "message", "severity", "latitude", "longitude", "is_resolved", "created_at", "resolved_at"]
        read_only_fields = ["id", "created_at"]


class BusRoutePickupUpdateSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    stop_name = serializers.CharField(source="stop.stop_name", read_only=True)
    vehicle_no = serializers.CharField(source="vehicle.vehicle_no", read_only=True)

    class Meta:
        model = BusRoutePickupUpdate
        fields = ["id", "stop", "stop_name", "vehicle", "vehicle_no", "student", "student_name", "arrived_at", "picked_up_at", "status"]
        read_only_fields = ["id"]


# ===== INVENTORY MODULE SERIALIZERS =====
class ItemCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemCategory
        fields = ["id", "school", "title", "description", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "school", "created_at", "updated_at"]


class ItemStoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemStore
        fields = ["id", "school", "title", "description", "location", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "school", "created_at", "updated_at"]


class SupplierSerializer(serializers.ModelSerializer):
    def validate_phone(self, value):
        phone = str(value or "").strip()
        if not phone:
            return ""
        if not re.fullmatch(r"\d{1,12}", phone):
            raise serializers.ValidationError("Phone number must contain digits only and must not exceed 12 digits.")
        return phone

    class Meta:
        model = Supplier
        fields = ["id", "school", "name", "contact_person", "email", "phone", "address", "city", "country", "tax_id", "payment_terms", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "school", "created_at", "updated_at"]


class ItemSerializer(serializers.ModelSerializer):
    category_title = serializers.CharField(source="category.title", read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)

    class Meta:
        model = Item
        fields = ["id", "school", "category", "category_title", "item_code", "name", "description", "unit", "quantity", "reorder_level", "unit_cost", "unit_price", "supplier", "supplier_name", "item_photo", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "school", "created_at", "updated_at"]


class ItemReceiveChildSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    item_code = serializers.CharField(source="item.item_code", read_only=True)

    class Meta:
        model = ItemReceiveChild
        fields = ["id", "receive", "item", "item_name", "item_code", "quantity", "unit_cost", "total_cost"]
        read_only_fields = ["id", "total_cost"]


class ItemReceiveSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    line_items = ItemReceiveChildSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source="created_by.first_name", read_only=True)

    class Meta:
        model = ItemReceive
        fields = ["id", "school", "supplier", "supplier_name", "receive_date", "total_amount", "discount", "tax", "payment_status", "paid_amount", "reference_no", "notes", "line_items", "created_by", "created_by_name", "created_at", "updated_at"]
        read_only_fields = ["id", "school", "created_at", "updated_at"]


class ItemIssueSerializer(serializers.ModelSerializer):
    store_title = serializers.CharField(source="store.title", read_only=True)
    issued_by_name = serializers.CharField(source="issued_by.first_name", read_only=True)

    class Meta:
        model = ItemIssue
        fields = ["id", "school", "issue_date", "store", "store_title", "subject", "notes", "issued_by", "issued_by_name", "created_at", "updated_at"]
        read_only_fields = ["id", "school", "created_at", "updated_at"]


class ItemSellChildSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    item_code = serializers.CharField(source="item.item_code", read_only=True)

    class Meta:
        model = ItemSellChild
        fields = ["id", "sell", "item", "item_name", "item_code", "quantity", "unit_price", "total_price"]
        read_only_fields = ["id", "total_price"]


class ItemSellSerializer(serializers.ModelSerializer):
    line_items = ItemSellChildSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source="created_by.first_name", read_only=True)

    class Meta:
        model = ItemSell
        fields = ["id", "school", "sell_date", "total_amount", "discount", "tax", "payment_status", "paid_amount", "reference_no", "notes", "sold_to", "line_items", "created_by", "created_by_name", "created_at", "updated_at"]
        read_only_fields = ["id", "school", "created_at", "updated_at"]
