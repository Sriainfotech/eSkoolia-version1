from rest_framework import permissions, status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from django.db import IntegrityError
from django.db.models import Case, IntegerField, Value, When
from config.pagination import ApiPageNumberPagination
from .models import AcademicYear, Class, ClassPeriod, ClassRoom, Section, Subject, Vehicle, TransportRoute, AssignVehicle
from .models import BusStop, BusLocation, TransportAlert, BusRoutePickupUpdate
from .models import ItemCategory, ItemStore, Supplier, Item, ItemReceive, ItemIssue, ItemSell
from .serializers import (
    AcademicYearSerializer,
    ClassPeriodSerializer,
    ClassRoomSerializer,
    ClassSerializer,
    SectionSerializer,
    SubjectSerializer,
    VehicleSerializer,
    TransportRouteSerializer,
    AssignVehicleSerializer,
    BusStopSerializer,
    BusLocationSerializer,
    TransportAlertSerializer,
    BusRoutePickupUpdateSerializer,
    ItemCategorySerializer,
    ItemStoreSerializer,
    SupplierSerializer,
    ItemSerializer,
    ItemReceiveSerializer,
    ItemIssueSerializer,
    ItemSellSerializer,
)


class TenantQueryMixin:
    """Filter queryset to the authenticated user's school."""
    model = None

    def get_queryset(self):
        user = self.request.user
        qs = self.model.objects.all()
        if user.is_superuser:
            return qs
        if user.school_id:
            return qs.filter(school_id=user.school_id)
        return qs.none()

    def perform_create(self, serializer):
        serializer.save(school=self.request.user.school)


class PermissionScopedViewSet(viewsets.ModelViewSet):
    permission_codes = {}

    def get_required_permission_code(self):
        action = getattr(self, "action", None)
        if action and action in self.permission_codes:
            return self.permission_codes[action]
        return self.permission_codes.get("*")

    def check_permissions(self, request):
        super().check_permissions(request)
        code = self.get_required_permission_code()
        if not code:
            return

        user = request.user
        if user.is_superuser:
            return

        if not hasattr(user, "has_permission_code") or not user.has_permission_code(code):
            raise PermissionDenied("You do not have permission to perform this action.")


class AcademicYearViewSet(TenantQueryMixin, viewsets.ModelViewSet):
    model = AcademicYear
    serializer_class = AcademicYearSerializer
    permission_classes = [permissions.IsAuthenticated]


class ClassViewSet(TenantQueryMixin, viewsets.ModelViewSet):
    model = Class
    serializer_class = ClassSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Class.objects.prefetch_related("sections").annotate(
            admission_order=Case(
                When(name__iexact="Nursery", then=Value(0)),
                When(name__iexact="LKG", then=Value(1)),
                When(name__iexact="UKG", then=Value(2)),
                When(name__iexact="1", then=Value(3)),
                When(name__iexact="2", then=Value(4)),
                When(name__iexact="3", then=Value(5)),
                When(name__iexact="4", then=Value(6)),
                When(name__iexact="5", then=Value(7)),
                When(name__iexact="6", then=Value(8)),
                When(name__iexact="7", then=Value(9)),
                When(name__iexact="8", then=Value(10)),
                When(name__iexact="9", then=Value(11)),
                When(name__iexact="10", then=Value(12)),
                When(name__iexact="11", then=Value(13)),
                When(name__iexact="12", then=Value(14)),
                default=Value(2000),
                output_field=IntegerField(),
            )
        ).order_by("admission_order", "numeric_order", "name", "id")
        if user.is_superuser:
            return qs
        if user.school_id:
            return qs.filter(school_id=user.school_id)
        return qs.none()

    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except IntegrityError as exc:
            message = str(exc).lower()
            if "school_classes.school_id" in message and "school_classes.name" in message:
                raise ValidationError({"name": ["Class name already exists"]})
            raise ValidationError({"detail": "Unable to save class due to data integrity rules."})

    def update(self, request, *args, **kwargs):
        try:
            return super().update(request, *args, **kwargs)
        except IntegrityError as exc:
            message = str(exc).lower()
            if "school_classes.school_id" in message and "school_classes.name" in message:
                raise ValidationError({"name": ["Class name already exists"]})
            raise ValidationError({"detail": "Unable to update class due to data integrity rules."})

    def partial_update(self, request, *args, **kwargs):
        try:
            return super().partial_update(request, *args, **kwargs)
        except IntegrityError as exc:
            message = str(exc).lower()
            if "school_classes.school_id" in message and "school_classes.name" in message:
                raise ValidationError({"name": ["Class name already exists"]})
            raise ValidationError({"detail": "Unable to update class due to data integrity rules."})


class SectionViewSet(viewsets.ModelViewSet):
    serializer_class = SectionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _split_section_names(self, raw_value):
        if raw_value is None:
            return []
        parts = [part.strip() for part in str(raw_value).split(",")]
        return [part for part in parts if part]

    def _normalize_legacy_combined_sections(self, queryset):
        combined_rows = queryset.filter(name__contains=",")
        for row in combined_rows:
            names = self._split_section_names(row.name)
            if not names:
                row.delete()
                continue

            existing_lower = set(
                Section.objects.filter(school_class_id=row.school_class_id)
                .exclude(pk=row.pk)
                .values_list("name", flat=True)
            )
            existing_lower = {name.casefold() for name in existing_lower if name}

            for section_name in names:
                if section_name.casefold() in existing_lower:
                    continue
                Section.objects.create(
                    school_class_id=row.school_class_id,
                    name=section_name,
                    capacity=row.capacity,
                )
                existing_lower.add(section_name.casefold())

            row.delete()

    def get_queryset(self):
        user = self.request.user
        qs = Section.objects.select_related("school_class__school")
        class_filter = (self.request.query_params.get("class") or self.request.query_params.get("school_class") or "").strip()
        if user.is_superuser:
            self._normalize_legacy_combined_sections(qs)
            scoped = Section.objects.select_related("school_class__school")
            if class_filter.isdigit():
                scoped = scoped.filter(school_class_id=int(class_filter))
            return scoped
        if user.school_id:
            scoped_qs = qs.filter(school_class__school_id=user.school_id)
            self._normalize_legacy_combined_sections(scoped_qs)
            scoped = Section.objects.select_related("school_class__school").filter(school_class__school_id=user.school_id)
            if class_filter.isdigit():
                scoped = scoped.filter(school_class_id=int(class_filter))
            return scoped
        return qs.none()

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        school_class_id = data.get("school_class")
        split_names = self._split_section_names(data.get("name"))

        if not split_names:
            raise ValidationError({"name": "Section name is required."})

        if len(split_names) == 1:
            data["name"] = split_names[0]
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

        duplicate_input = []
        seen_input = set()
        for name in split_names:
            key = name.casefold()
            if key in seen_input:
                duplicate_input.append(name)
            seen_input.add(key)

        if duplicate_input:
            raise ValidationError({"name": [f"Duplicate section names in input: {', '.join(sorted(set(duplicate_input)))}"]})

        existing_lower = set(
            Section.objects.filter(school_class_id=school_class_id).values_list("name", flat=True)
        )
        existing_lower = {name.casefold() for name in existing_lower if name}

        max_sections_per_class = getattr(SectionSerializer, "MAX_SECTIONS_PER_CLASS", 26)
        existing_count = Section.objects.filter(school_class_id=school_class_id).count()
        if existing_count + len(split_names) > max_sections_per_class:
            raise ValidationError({"name": ["Section limit reached for this class."]})

        duplicate_existing = [name for name in split_names if name.casefold() in existing_lower]
        if duplicate_existing:
            raise ValidationError({"name": ["Section name already exists"]})

        created_rows = []
        for section_name in split_names:
            row_data = data.copy()
            row_data["name"] = section_name
            serializer = self.get_serializer(data=row_data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            created_rows.append(serializer.data)

        return Response(
            {
                "success": True,
                "message": "Sections created successfully.",
                "count": len(created_rows),
                "data": created_rows,
            },
            status=status.HTTP_201_CREATED,
        )


class SubjectViewSet(TenantQueryMixin, viewsets.ModelViewSet):
    model = Subject
    serializer_class = SubjectSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        return Response(
            {
                "success": True,
                "message": "Subject created successfully",
                "data": response.data,
            },
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        return Response(
            {
                "success": True,
                "message": "Subject updated successfully",
                "data": response.data,
            },
            status=status.HTTP_200_OK,
        )

    def partial_update(self, request, *args, **kwargs):
        response = super().partial_update(request, *args, **kwargs)
        return Response(
            {
                "success": True,
                "message": "Subject updated successfully",
                "data": response.data,
            },
            status=status.HTTP_200_OK,
        )

    def destroy(self, request, *args, **kwargs):
        subject = self.get_object()

        # Business rule: prevent deletion if in timetable/exams/attendance.
        from apps.academics.models import ClassRoutineSlot
        from apps.exams.models import ExamSchedule, ExamSetup, ExamRoutine, ExamAttendance
        from apps.attendance.models import SubjectAttendance

        blockers = []
        school_id = subject.school_id

        if ClassRoutineSlot.objects.filter(school_id=school_id, subject_id=subject.id).exists():
            blockers.append("Timetable")
        if ExamSchedule.objects.filter(school_id=school_id, subject_id=subject.id).exists() \
            or ExamSetup.objects.filter(school_id=school_id, subject_id=subject.id).exists() \
            or ExamRoutine.objects.filter(school_id=school_id, subject_id=subject.id).exists() \
            or ExamAttendance.objects.filter(school_id=school_id, subject_id=subject.id).exists():
            blockers.append("Exams")
        if SubjectAttendance.objects.filter(school_id=school_id, subject_id=subject.id).exists():
            blockers.append("Attendance")

        if blockers:
            raise ValidationError(
                {
                    "subject": [f"Subject cannot be deleted because it is used in: {', '.join(blockers)}."],
                }
            )

        super().destroy(request, *args, **kwargs)
        return Response(
            {
                "success": True,
                "message": "Subject deleted successfully",
            },
            status=status.HTTP_200_OK,
        )


class ClassPeriodViewSet(TenantQueryMixin, viewsets.ModelViewSet):
    model = ClassPeriod
    serializer_class = ClassPeriodSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        period_type = self.request.query_params.get("period_type") or self.request.query_params.get("type")
        if period_type:
            queryset = queryset.filter(period_type=period_type)
        return queryset.order_by("start_time", "period")


class ClassRoomViewSet(TenantQueryMixin, viewsets.ModelViewSet):
    model = ClassRoom
    serializer_class = ClassRoomSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.order_by("room_no", "id")

    def _normalized_errors(self, serializer_errors):
        if isinstance(serializer_errors, dict):
            message_values = serializer_errors.get("message")
            if isinstance(message_values, list) and message_values:
                return serializer_errors, str(message_values[0])
            if isinstance(message_values, str) and message_values:
                return serializer_errors, message_values

            cleaned = {}
            for key, value in serializer_errors.items():
                if isinstance(value, list):
                    cleaned[key] = [str(item) for item in value]
                else:
                    cleaned[key] = [str(value)]
            return cleaned, "Validation failed"
        return {}, "Validation failed"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            errors, message = self._normalized_errors(serializer.errors)
            payload = {"success": False, "message": message}
            if errors:
                payload["errors"] = errors
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)

        try:
            self.perform_create(serializer)
        except IntegrityError:
            return Response(
                {
                    "success": False,
                    "message": "Room already exists",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {
                "success": True,
                "message": "Room added successfully",
                "data": serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if not serializer.is_valid():
            errors, message = self._normalized_errors(serializer.errors)
            payload = {"success": False, "message": message}
            if errors:
                payload["errors"] = errors
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)

        try:
            self.perform_update(serializer)
        except IntegrityError:
            return Response(
                {
                    "success": False,
                    "message": "Room already exists",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {
                "success": True,
                "message": "Room updated successfully",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        room = self.get_object()

        # Prevent deletion when room is already used in timetable or lesson planning.
        from apps.academics.models import ClassRoutineSlot, LessonPlanner

        in_use = ClassRoutineSlot.objects.filter(school_id=room.school_id, room_id=room.id).exists() or \
            LessonPlanner.objects.filter(school_id=room.school_id, room_id=room.id).exists()

        if in_use:
            return Response(
                {
                    "success": False,
                    "message": "Cannot delete. Room is already assigned",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        super().destroy(request, *args, **kwargs)
        return Response(
            {
                "success": True,
                "message": "Room deleted successfully",
            },
            status=status.HTTP_200_OK,
        )


# ===== TRANSPORT MODULE VIEWSETS =====
class VehicleViewSet(TenantQueryMixin, PermissionScopedViewSet):
    model = Vehicle
    serializer_class = VehicleSerializer
    permission_classes = [permissions.IsAuthenticated]
    permission_codes = {"*": "transport.vehicle.view"}

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.select_related("driver", "academic_year", "school")

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError
        
        school = self.request.user.school
        if not school:
            raise ValidationError({"school": "User does not have a school assigned."})
        
        # Try to get current academic year, fallback to latest one
        academic_year = AcademicYear.objects.filter(school=school, is_current=True).first()
        if not academic_year:
            academic_year = AcademicYear.objects.filter(school=school).order_by("-start_date").first()
        
        if not academic_year:
            raise ValidationError({"academic_year": "No academic year found for your school. Please create one first."})
        
        serializer.save(school=school, academic_year=academic_year)


class TransportRouteViewSet(TenantQueryMixin, PermissionScopedViewSet):
    model = TransportRoute
    serializer_class = TransportRouteSerializer
    permission_classes = [permissions.IsAuthenticated]
    permission_codes = {"*": "transport.route.view"}

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.select_related("academic_year", "school")

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError
        
        school = self.request.user.school
        if not school:
            raise ValidationError({"school": "User does not have a school assigned."})
        
        # Try to get current academic year, fallback to latest one
        academic_year = AcademicYear.objects.filter(school=school, is_current=True).first()
        if not academic_year:
            academic_year = AcademicYear.objects.filter(school=school).order_by("-start_date").first()
        
        if not academic_year:
            raise ValidationError({"academic_year": "No academic year found for your school. Please create one first."})
        
        serializer.save(school=school, academic_year=academic_year)


class AssignVehicleViewSet(TenantQueryMixin, PermissionScopedViewSet):
    model = AssignVehicle
    serializer_class = AssignVehicleSerializer
    permission_classes = [permissions.IsAuthenticated]
    permission_codes = {"*": "transport.assign_vehicle.view"}

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.select_related("vehicle", "route", "academic_year", "school")

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError
        
        school = self.request.user.school
        if not school:
            raise ValidationError({"school": "User does not have a school assigned."})
        
        # Try to get current academic year, fallback to latest one
        academic_year = AcademicYear.objects.filter(school=school, is_current=True).first()
        if not academic_year:
            academic_year = AcademicYear.objects.filter(school=school).order_by("-start_date").first()
        
        if not academic_year:
            raise ValidationError({"academic_year": "No academic year found for your school. Please create one first."})
        
        serializer.save(school=school, academic_year=academic_year)


# ===== BUS TRACKING MODULE VIEWSETS =====
class BusStopViewSet(TenantQueryMixin, PermissionScopedViewSet):
    model = BusStop
    serializer_class = BusStopSerializer
    permission_classes = [permissions.IsAuthenticated]
    permission_codes = {"*": "transport.route.view"}
    
    def get_queryset(self):
        user = self.request.user
        queryset = BusStop.objects.all()
        if not user.is_superuser:
            if user.school_id:
                queryset = queryset.filter(route__school_id=user.school_id)
            else:
                return queryset.none()
        route_id = self.request.query_params.get("route_id")
        if route_id:
            queryset = queryset.filter(route_id=route_id)
        return queryset.select_related("route").order_by("stop_order")


class BusLocationViewSet(TenantQueryMixin, PermissionScopedViewSet):
    model = BusLocation
    serializer_class = BusLocationSerializer
    permission_classes = [permissions.IsAuthenticated]
    permission_codes = {"*": "transport.vehicle.view"}
    
    def get_queryset(self):
        user = self.request.user
        queryset = BusLocation.objects.all()
        if not user.is_superuser:
            if user.school_id:
                queryset = queryset.filter(vehicle__school_id=user.school_id)
            else:
                return queryset.none()

        route_id = self.request.query_params.get("route_id")
        if route_id:
            queryset = queryset.filter(vehicle__assignments__route_id=route_id)

        vehicle_id = self.request.query_params.get("vehicle_id")
        if vehicle_id:
            queryset = queryset.filter(vehicle_id=vehicle_id)
        return queryset.select_related("vehicle").order_by("-timestamp").distinct()
    
    def create(self, request, *args, **kwargs):
        """Update or create bus location (called from mobile GPS tracker)"""
        vehicle_id = request.data.get("vehicle")
        if not vehicle_id:
            return Response({"error": "vehicle_id required"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get or create - update existing location
        location, created = BusLocation.objects.update_or_create(
            vehicle_id=vehicle_id,
            defaults={
                "latitude": request.data.get("latitude"),
                "longitude": request.data.get("longitude"),
                "speed": request.data.get("speed", 0),
                "heading": request.data.get("heading", 0),
                "accuracy": request.data.get("accuracy", 0),
                "is_active": True,
            }
        )
        serializer = self.get_serializer(location)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class TransportAlertViewSet(TenantQueryMixin, PermissionScopedViewSet):
    model = TransportAlert
    serializer_class = TransportAlertSerializer
    permission_classes = [permissions.IsAuthenticated]
    permission_codes = {"*": "transport.vehicle.view"}
    
    def get_queryset(self):
        user = self.request.user
        queryset = TransportAlert.objects.all()
        if not user.is_superuser:
            if user.school_id:
                queryset = queryset.filter(vehicle__school_id=user.school_id)
            else:
                return queryset.none()

        vehicle_id = self.request.query_params.get("vehicle_id")
        alert_type = self.request.query_params.get("alert_type")
        is_resolved = self.request.query_params.get("is_resolved")
        
        if vehicle_id:
            queryset = queryset.filter(vehicle_id=vehicle_id)
        if alert_type:
            queryset = queryset.filter(alert_type=alert_type)
        if is_resolved is not None:
            queryset = queryset.filter(is_resolved=(is_resolved.lower() == 'true'))
        
        return queryset.select_related("vehicle", "route").order_by("-created_at")
    
    def update(self, request, *args, **kwargs):
        """Resolve alert by setting is_resolved & resolved_at"""
        instance = self.get_object()
        if request.data.get("is_resolved") and not instance.resolved_at:
            from django.utils import timezone
            instance.resolved_at = timezone.now()
        return super().update(request, *args, **kwargs)


class BusRoutePickupUpdateViewSet(TenantQueryMixin, PermissionScopedViewSet):
    model = BusRoutePickupUpdate
    serializer_class = BusRoutePickupUpdateSerializer
    permission_classes = [permissions.IsAuthenticated]
    permission_codes = {"*": "transport.vehicle.view"}
    
    def get_queryset(self):
        user = self.request.user
        queryset = BusRoutePickupUpdate.objects.all()
        if not user.is_superuser:
            if user.school_id:
                queryset = queryset.filter(vehicle__school_id=user.school_id)
            else:
                return queryset.none()

        vehicle_id = self.request.query_params.get("vehicle_id")
        stop_id = self.request.query_params.get("stop_id")
        student_id = self.request.query_params.get("student_id")
        status_filter = self.request.query_params.get("status")
        
        if vehicle_id:
            queryset = queryset.filter(vehicle_id=vehicle_id)
        if stop_id:
            queryset = queryset.filter(stop_id=stop_id)
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset.select_related("stop", "vehicle", "student").order_by("-arrived_at")


# ===== INVENTORY MODULE VIEWSETS =====
class ItemCategoryViewSet(TenantQueryMixin, PermissionScopedViewSet):
    model = ItemCategory
    serializer_class = ItemCategorySerializer
    pagination_class = ApiPageNumberPagination
    permission_classes = [permissions.IsAuthenticated]
    permission_codes = {"*": "inventory.item_category.view"}

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.order_by("title")


class ItemStoreViewSet(TenantQueryMixin, PermissionScopedViewSet):
    model = ItemStore
    serializer_class = ItemStoreSerializer
    pagination_class = ApiPageNumberPagination
    permission_classes = [permissions.IsAuthenticated]
    permission_codes = {"*": "inventory.item_store.view"}

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.order_by("title")


class SupplierViewSet(TenantQueryMixin, PermissionScopedViewSet):
    model = Supplier
    serializer_class = SupplierSerializer
    pagination_class = ApiPageNumberPagination
    permission_classes = [permissions.IsAuthenticated]
    permission_codes = {"*": "inventory.supplier.view"}

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.order_by("name")


class ItemViewSet(TenantQueryMixin, PermissionScopedViewSet):
    model = Item
    serializer_class = ItemSerializer
    pagination_class = ApiPageNumberPagination
    permission_classes = [permissions.IsAuthenticated]
    permission_codes = {"*": "inventory.item.view"}

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.select_related("category", "supplier").order_by("item_code")

    def perform_create(self, serializer):
        school = self.request.user.school
        if not school:
            raise PermissionDenied("School context is required.")
        serializer.save(school=school)


class ItemReceiveViewSet(TenantQueryMixin, PermissionScopedViewSet):
    model = ItemReceive
    serializer_class = ItemReceiveSerializer
    pagination_class = ApiPageNumberPagination
    permission_classes = [permissions.IsAuthenticated]
    permission_codes = {"*": "inventory.item_receive.view"}

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.select_related("supplier", "created_by").order_by("-receive_date")

    def perform_create(self, serializer):
        school = self.request.user.school
        if not school:
            raise PermissionDenied("School context is required.")
        serializer.save(school=school, created_by=self.request.user)


class ItemIssueViewSet(TenantQueryMixin, PermissionScopedViewSet):
    model = ItemIssue
    serializer_class = ItemIssueSerializer
    pagination_class = ApiPageNumberPagination
    permission_classes = [permissions.IsAuthenticated]
    permission_codes = {"*": "inventory.item_issue.view"}

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.select_related("store", "issued_by").order_by("-issue_date")

    def perform_create(self, serializer):
        school = self.request.user.school
        if not school:
            raise PermissionDenied("School context is required.")
        serializer.save(school=school, issued_by=self.request.user)


class ItemSellViewSet(TenantQueryMixin, PermissionScopedViewSet):
    model = ItemSell
    serializer_class = ItemSellSerializer
    pagination_class = ApiPageNumberPagination
    permission_classes = [permissions.IsAuthenticated]
    permission_codes = {"*": "inventory.item_sell.view"}

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.select_related("created_by").order_by("-sell_date")

    def perform_create(self, serializer):
        school = self.request.user.school
        if not school:
            raise PermissionDenied("School context is required.")
        serializer.save(school=school, created_by=self.request.user)
