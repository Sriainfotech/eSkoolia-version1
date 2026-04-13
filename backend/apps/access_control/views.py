from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from django.db import IntegrityError
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import AuthenticationFailed, NotAuthenticated, NotFound, PermissionDenied as DRFPermissionDenied, ValidationError
from rest_framework.response import Response

from apps.core.models import Class, Section
from apps.fees.models import FeesAssignment
from apps.hr.models import Staff
from apps.students.models import Student, StudentMultiClassRecord

from .models import Permission, Role, UserRole
from .permission_classes import CanManageRoles, CanManageUserRoles, CanViewPermissions
from .serializers import PermissionSerializer, RoleSerializer, UserRoleSerializer
from config.pagination import ApiPageNumberPagination

User = get_user_model()


class StandardizedAccessControlResponseMixin:
    """Provide consistent success/error payloads and status mapping for access-control APIs."""

    def success_response(self, message, data=None, status_code=status.HTTP_200_OK):
        return Response(
            {
                "success": True,
                "message": message,
                "data": data if data is not None else {},
            },
            status=status_code,
        )

    def error_response(self, message, status_code, errors=None):
        return Response(
            {
                "success": False,
                "message": message,
                "errors": errors if errors is not None else {},
            },
            status=status_code,
        )

    def handle_exception(self, exc):
        # 401: missing/invalid/expired authentication credentials.
        if isinstance(exc, (NotAuthenticated, AuthenticationFailed)):
            return self.error_response(
                "Authentication credentials were not provided or invalid",
                status.HTTP_401_UNAUTHORIZED,
            )

        # 403: authenticated user without required authorization.
        if isinstance(exc, DRFPermissionDenied):
            return self.error_response(
                "You do not have permission to perform this action",
                status.HTTP_403_FORBIDDEN,
            )

        # 404: role/permission resources not found.
        if isinstance(exc, NotFound):
            return self.error_response(str(exc.detail), status.HTTP_404_NOT_FOUND)

        # 400: serializer and business-rule validation failures.
        if isinstance(exc, ValidationError):
            errors = exc.detail if isinstance(exc.detail, dict) else {}
            message = "Validation failed"
            if isinstance(exc.detail, dict) and exc.detail:
                first_value = next(iter(exc.detail.values()))
                if isinstance(first_value, list) and first_value:
                    message = str(first_value[0])
                elif isinstance(first_value, str):
                    message = first_value
            elif isinstance(exc.detail, list) and exc.detail:
                message = str(exc.detail[0])
            elif isinstance(exc.detail, str):
                message = exc.detail

            return self.error_response(message, status.HTTP_400_BAD_REQUEST, errors=errors)

        # 500: fallback for unexpected errors in critical paths.
        return self.error_response("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)


def _coerce_bool(value):
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).lower() in {"1", "true", "yes", "on"}


def _normalize_phone(value: str | None) -> str:
    if not value:
        return ""
    return "".join(ch for ch in str(value) if ch.isdigit())


def _is_student_role(role: Role) -> bool:
    if not role:
        return False
    name = (role.name or "").lower()
    return "student" in name


def _is_parent_role(role: Role) -> bool:
    if not role:
        return False
    name = (role.name or "").lower()
    return "parent" in name


class PermissionViewSet(StandardizedAccessControlResponseMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [permissions.IsAuthenticated, CanViewPermissions]

    def get_object(self):
        try:
            return super().get_object()
        except (Http404, ValueError, TypeError, DjangoValidationError):
            raise NotFound("Permission not found")

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return self.success_response("Permissions fetched successfully", serializer.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return self.success_response("Permission fetched successfully", serializer.data)


class RoleViewSet(StandardizedAccessControlResponseMixin, viewsets.ModelViewSet):
    serializer_class = RoleSerializer
    permission_classes = [permissions.IsAuthenticated, CanManageRoles]
    pagination_class = ApiPageNumberPagination

    def get_queryset(self):
        user = self.request.user
        queryset = Role.objects.prefetch_related("permissions")
        if user.is_superuser:
            pass
        elif user.school_id:
            queryset = queryset.filter(school_id=user.school_id)
        else:
            queryset = queryset.filter(school__isnull=True)

        search = (self.request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(name__icontains=search)

        ordering = (self.request.query_params.get("ordering") or "").strip()
        if ordering:
            queryset = queryset.order_by(ordering)
        else:
            queryset = queryset.order_by("name")

        return queryset

    def get_object(self):
        try:
            return super().get_object()
        except (Http404, ValueError, TypeError, DjangoValidationError):
            raise NotFound("Role not found")

    def perform_create(self, serializer):
        user = self.request.user
        try:
            serializer.save(school=user.school)
        except IntegrityError:
            raise ValidationError({"name": "Role with this name already exists."})

    def perform_update(self, serializer):
        try:
            serializer.save()
        except IntegrityError:
            raise ValidationError({"name": "Role with this name already exists."})

    def perform_destroy(self, instance):
        # 400 business rule: system roles are not deletable.
        if instance.is_system:
            raise ValidationError({"role": "Cannot delete system role."})

        # 400 business rule: roles assigned to users are not deletable.
        if instance.user_roles.exists():
            raise ValidationError({"role": "Cannot delete role assigned to users."})

        instance.delete()

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            response = self.get_paginated_response(serializer.data)
            payload = dict(response.data)
            payload["success"] = True
            payload["message"] = "Roles fetched successfully"
            payload["data"] = payload.get("results", [])
            return Response(payload, status=response.status_code)
        serializer = self.get_serializer(queryset, many=True)
        return self.success_response("Roles fetched successfully", serializer.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return self.success_response("Role fetched successfully", serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return self.success_response(
            "Role created successfully",
            serializer.data,
            status_code=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return self.success_response("Role updated successfully", serializer.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return self.success_response("Role deleted successfully", data={})

    @staticmethod
    def _module_label(module_code: str) -> str:
        return (module_code or "").replace("_", " ").replace("-", " ").title()

    def _build_permission_tree_rows(self, selected_ids: set[int]):
        grouped = {}
        for perm in Permission.objects.order_by("module", "name"):
            grouped.setdefault(perm.module, []).append(
                {
                    "id": perm.id,
                    "code": perm.code,
                    "name": perm.name,
                    "selected": perm.id in selected_ids,
                }
            )

        rows = []
        for module, perms in grouped.items():
            rows.append(
                {
                    "module": module,
                    "module_name": self._module_label(module),
                    "permissions": perms,
                }
            )
        return rows

    @action(detail=False, methods=["get"], url_path="permission-tree")
    def permission_tree(self, request):
        role_id = request.query_params.get("role") or request.query_params.get("role_id")
        role = None
        selected_ids = set()
        if role_id:
            role = self.get_queryset().filter(id=role_id).first()
            if not role:
                raise NotFound("Role not found")
            selected_ids = set(role.permissions.values_list("id", flat=True))
        rows = self._build_permission_tree_rows(selected_ids)
        return self.success_response(
            "Permission tree fetched successfully",
            {
                "role": {"id": role.id, "name": role.name} if role else None,
                "modules": rows,
            },
        )

    @action(detail=True, methods=["get"], url_path="permission-tree")
    def permission_tree_by_role(self, request, pk=None):
        role = self.get_object()
        selected_ids = set(role.permissions.values_list("id", flat=True))
        rows = self._build_permission_tree_rows(selected_ids)
        return self.success_response(
            "Permission tree fetched successfully",
            {
                "role": {"id": role.id, "name": role.name},
                "modules": rows,
            },
        )

    @action(detail=True, methods=["post"], url_path="assign-permissions")
    def assign_permissions(self, request, pk=None):
        role = self.get_object()
        permission_ids = request.data.get("permission_ids", [])
        if not isinstance(permission_ids, list):
            raise ValidationError({"permission_ids": "permission_ids must be a list."})

        normalized_ids = []
        for raw_id in permission_ids:
            try:
                normalized_ids.append(int(raw_id))
            except (TypeError, ValueError):
                raise ValidationError({"permission_ids": "permission_ids must contain integer IDs."})

        unique_ids = list(dict.fromkeys(normalized_ids))
        permissions_qs = Permission.objects.filter(id__in=unique_ids)
        found_ids = set(permissions_qs.values_list("id", flat=True))
        invalid_ids = [pid for pid in unique_ids if pid not in found_ids]
        if invalid_ids:
            raise NotFound("Permission not found")

        role.permissions.set(permissions_qs)
        return self.success_response(
            "Permissions assigned successfully",
            {
                "role_id": role.id,
                "permission_ids": list(permissions_qs.values_list("id", flat=True)),
            },
        )


class UserRoleViewSet(viewsets.ModelViewSet):
    serializer_class = UserRoleSerializer
    permission_classes = [permissions.IsAuthenticated, CanManageUserRoles]

    def get_queryset(self):
        user = self.request.user
        queryset = UserRole.objects.select_related("user", "role")

        role_id = self.request.query_params.get("role")
        if role_id:
            queryset = queryset.filter(role_id=role_id)

        if user.is_superuser:
            return queryset
        if user.school_id:
            return queryset.filter(role__school_id=user.school_id)
        return queryset.none()


class LoginAccessControlViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated, CanManageUserRoles]

    def _roles_queryset(self, request):
        qs = Role.objects.order_by("name")
        if request.user.is_superuser:
            return qs
        if request.user.school_id:
            return qs.filter(Q(school_id=request.user.school_id) | Q(school__isnull=True))
        return Role.objects.none()

    def list(self, request):
        classes_qs = Class.objects.order_by("numeric_order", "name")
        sections_qs = Section.objects.select_related("school_class").order_by("name")
        if not request.user.is_superuser and request.user.school_id:
            classes_qs = classes_qs.filter(school_id=request.user.school_id)
            sections_qs = sections_qs.filter(school_class__school_id=request.user.school_id)

        roles = []
        for row in self._roles_queryset(request):
            if str(row.id) == "1" or _is_parent_role(row):
                continue
            roles.append({"id": row.id, "name": row.name})
        classes = [{"id": row.id, "name": row.name} for row in classes_qs]
        sections = [{"id": row.id, "name": row.name, "class_id": row.school_class_id} for row in sections_qs]
        return Response({"roles": roles, "classes": classes, "sections": sections}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="users")
    def users(self, request):
        role_id = request.query_params.get("role")
        class_id = request.query_params.get("class") or request.query_params.get("class_id")
        section_id = request.query_params.get("section") or request.query_params.get("section_id")
        search = (request.query_params.get("search") or "").strip()
        name = (request.query_params.get("name") or "").strip()
        admission_no = (request.query_params.get("admission_no") or "").strip()
        roll_no = (request.query_params.get("roll_no") or "").strip()

        if not role_id:
            return Response({"detail": "role query param is required."}, status=status.HTTP_400_BAD_REQUEST)

        role = self._roles_queryset(request).filter(id=role_id).first()
        if not role:
            return Response({"detail": "Role not found."}, status=status.HTTP_404_NOT_FOUND)
        if _is_parent_role(role):
            return Response({"detail": "Parent role is managed under student rows in this screen."}, status=status.HTTP_400_BAD_REQUEST)

        user_role_qs = UserRole.objects.select_related("user", "role").filter(role_id=role.id)
        if not request.user.is_superuser and request.user.school_id:
            user_role_qs = user_role_qs.filter(Q(role__school_id=request.user.school_id) | Q(role__school__isnull=True))

        linked_student_by_username = {}
        linked_parent_by_student_username = {}
        if _is_student_role(role):
            if not class_id:
                return Response({"detail": "class query param is required for student role."}, status=status.HTTP_400_BAD_REQUEST)

            students_qs = Student.objects.select_related("current_class", "current_section", "guardian")
            if not request.user.is_superuser and request.user.school_id:
                students_qs = students_qs.filter(school_id=request.user.school_id)
            students_qs = students_qs.filter(current_class_id=class_id)
            if section_id:
                students_qs = students_qs.filter(current_section_id=section_id)
            if admission_no:
                students_qs = students_qs.filter(admission_no__icontains=admission_no)
            if roll_no:
                students_qs = students_qs.filter(roll_no__icontains=roll_no)
            if search:
                students_qs = students_qs.filter(
                    Q(first_name__icontains=search)
                    | Q(last_name__icontains=search)
                    | Q(admission_no__icontains=search)
                    | Q(roll_no__icontains=search)
                )
            if name:
                students_qs = students_qs.filter(Q(first_name__icontains=name) | Q(last_name__icontains=name))

            students_qs = students_qs.order_by("admission_no", "id")

            parent_role = None
            for role_row in self._roles_queryset(request):
                if _is_parent_role(role_row):
                    parent_role = role_row
                    break

            parent_users_by_phone = {}
            if parent_role:
                parent_user_roles = UserRole.objects.select_related("user", "role").filter(role_id=parent_role.id)
                if not request.user.is_superuser and request.user.school_id:
                    parent_user_roles = parent_user_roles.filter(
                        Q(role__school_id=request.user.school_id) | Q(role__school__isnull=True)
                    )
                for parent_row in parent_user_roles:
                    normalized = _normalize_phone(getattr(parent_row.user, "phone", ""))
                    if normalized:
                        parent_users_by_phone.setdefault(normalized, parent_row.user)

            # Fallback for schools where UserRole rows are not yet mapped for students:
            # match login users by username = admission_no.
            student_user_by_username = {
                row.user.username: row.user
                for row in user_role_qs.select_related("user").order_by("user_id")
            }
            admission_usernames = [str(v) for v in students_qs.values_list("admission_no", flat=True) if v]
            fallback_users = User.objects.filter(username__in=admission_usernames)
            if not request.user.is_superuser and request.user.school_id:
                fallback_users = fallback_users.filter(school_id=request.user.school_id)
            for user in fallback_users:
                student_user_by_username.setdefault(user.username, user)

            # Ensure each listed student has a login user and Student role mapping,
            # so actions (toggle/password) work similar to teacher rows.
            for student in students_qs:
                username_value = str(student.admission_no or "").strip()
                if not username_value:
                    continue

                student_user = student_user_by_username.get(username_value)
                if student_user is None:
                    student_user = User.objects.filter(username=username_value).first()

                if student_user is None:
                    student_user = User(
                        username=username_value,
                        first_name=(student.first_name or "").strip(),
                        last_name=(student.last_name or "").strip(),
                        school_id=student.school_id,
                        access_status=True,
                    )
                    student_user.set_password("123456")
                    student_user.save()

                if not UserRole.objects.filter(user_id=student_user.id, role_id=role.id).exists():
                    UserRole.objects.create(user_id=student_user.id, role_id=role.id)

                student_user_by_username[username_value] = student_user

            rows = []
            for student in students_qs:
                admission_value = str(student.admission_no or "")
                student_user = student_user_by_username.get(admission_value) if admission_value else None

                guardian_phone = _normalize_phone(getattr(student.guardian, "phone", ""))
                parent_user = parent_users_by_phone.get(guardian_phone) if guardian_phone else None

                student_name = f"{(student.first_name or '').strip()} {(student.last_name or '').strip()}".strip() or admission_value
                parent_name = ""
                if parent_user:
                    parent_name = (
                        f"{(parent_user.first_name or '').strip()} {(parent_user.last_name or '').strip()}".strip()
                        or parent_user.username
                    )

                rows.append(
                    {
                        "user_id": student_user.id if student_user else None,
                        "username": student_user.username if student_user else admission_value,
                        "name": student_name,
                        "email": student_user.email if student_user else "",
                        "role_id": role.id,
                        "role_name": role.name,
                        "access_status": bool(getattr(student_user, "access_status", False)) if student_user else False,
                        "staff_no": "",
                        "admission_no": student.admission_no,
                        "roll_no": student.roll_no,
                        "class_name": student.current_class.name if student.current_class else "",
                        "section_name": student.current_section.name if student.current_section else "",
                        "parent_user_id": parent_user.id if parent_user else None,
                        "parent_username": parent_user.username if parent_user else "",
                        "parent_name": parent_name,
                        "parent_email": parent_user.email if parent_user else "",
                        "parent_access_status": bool(getattr(parent_user, "access_status", False)) if parent_user else False,
                    }
                )

            return Response({"role": {"id": role.id, "name": role.name}, "users": rows}, status=status.HTTP_200_OK)
        elif search:
            user_role_qs = user_role_qs.filter(
                Q(user__username__icontains=search)
                | Q(user__first_name__icontains=search)
                | Q(user__last_name__icontains=search)
                | Q(user__email__icontains=search)
            )
        elif name:
            user_role_qs = user_role_qs.filter(Q(user__first_name__icontains=name) | Q(user__last_name__icontains=name))

        rows = []
        seen = set()
        staff_map = {
            row.user_id: row
            for row in Staff.objects.filter(user_id__in=user_role_qs.values_list("user_id", flat=True)).only(
                "user_id", "staff_no"
            )
        }

        for row in user_role_qs.order_by("user_id"):
            if row.user_id in seen:
                continue
            seen.add(row.user_id)

            user = row.user
            full_name = f"{(user.first_name or '').strip()} {(user.last_name or '').strip()}".strip() or user.username
            linked_student = linked_student_by_username.get(user.username)
            linked_parent = linked_parent_by_student_username.get(user.username)
            staff = staff_map.get(user.id)

            parent_name = ""
            if linked_parent:
                parent_name = (
                    f"{(linked_parent.first_name or '').strip()} {(linked_parent.last_name or '').strip()}".strip()
                    or linked_parent.username
                )

            rows.append(
                {
                    "user_id": user.id,
                    "username": user.username,
                    "name": full_name,
                    "email": user.email,
                    "role_id": row.role_id,
                    "role_name": row.role.name,
                    "access_status": bool(getattr(user, "access_status", True)),
                    "staff_no": staff.staff_no if staff else "",
                    "admission_no": linked_student.admission_no if linked_student else "",
                    "roll_no": linked_student.roll_no if linked_student else "",
                    "class_name": linked_student.current_class.name if linked_student and linked_student.current_class else "",
                    "section_name": linked_student.current_section.name if linked_student and linked_student.current_section else "",
                    "parent_user_id": linked_parent.id if linked_parent else None,
                    "parent_username": linked_parent.username if linked_parent else "",
                    "parent_name": parent_name,
                    "parent_email": linked_parent.email if linked_parent else "",
                    "parent_access_status": bool(getattr(linked_parent, "access_status", False)) if linked_parent else False,
                }
            )

        return Response({"role": {"id": role.id, "name": role.name}, "users": rows}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="toggle")
    def toggle(self, request):
        user_id = request.data.get("user_id") or request.data.get("id")
        if not user_id:
            return Response({"detail": "user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        status_value = request.data.get("status")
        enabled = _coerce_bool(status_value)
        user = User.objects.filter(id=user_id).first()
        if not user:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if not request.user.is_superuser and request.user.school_id and user.school_id != request.user.school_id:
            return Response({"detail": "User does not belong to your school."}, status=status.HTTP_403_FORBIDDEN)

        user.access_status = enabled
        user.save(update_fields=["access_status"])
        return Response({"user_id": user.id, "access_status": user.access_status}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="reset-password")
    def reset_password(self, request):
        user_id = request.data.get("user_id") or request.data.get("id")
        use_default = _coerce_bool(request.data.get("default_password"))
        new_password = "123456" if use_default else (request.data.get("password") or "123456")
        if not user_id:
            return Response({"detail": "user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(id=user_id).first()
        if not user:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if not request.user.is_superuser and request.user.school_id and user.school_id != request.user.school_id:
            return Response({"detail": "User does not belong to your school."}, status=status.HTTP_403_FORBIDDEN)

        user.set_password(str(new_password))
        user.save(update_fields=["password"])
        return Response(
            {
                "detail": "Password updated.",
                "user_id": user.id,
                "default_password": "123456" if use_default else None,
            },
            status=status.HTTP_200_OK,
        )


class DueFeesLoginPermissionViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated, CanManageUserRoles]

    def _role_queryset(self, request):
        qs = Role.objects.order_by("name")
        if request.user.is_superuser:
            return qs
        if request.user.school_id:
            return qs.filter(Q(school_id=request.user.school_id) | Q(school__isnull=True))
        return Role.objects.none()

    def list(self, request):
        class_id = request.query_params.get("class") or request.query_params.get("class_id")
        classes_qs = Class.objects.order_by("numeric_order", "name")
        sections_qs = Section.objects.select_related("school_class").order_by("name")
        if not request.user.is_superuser and request.user.school_id:
            classes_qs = classes_qs.filter(school_id=request.user.school_id)
            sections_qs = sections_qs.filter(school_class__school_id=request.user.school_id)
        if class_id:
            sections_qs = sections_qs.filter(school_class_id=class_id)

        classes = [{"id": row.id, "name": row.name} for row in classes_qs]
        sections = [{"id": row.id, "name": row.name, "class_id": row.school_class_id} for row in sections_qs]

        return Response({"classes": classes, "sections": sections}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="users")
    def users(self, request):
        class_id = request.query_params.get("class") or request.query_params.get("class_id")
        section_id = request.query_params.get("section") or request.query_params.get("section_id")
        admission_no = (request.query_params.get("admission_no") or "").strip()
        name = (request.query_params.get("name") or "").strip()

        if not class_id and not section_id and not admission_no and not name:
            return Response({"users": []}, status=status.HTTP_200_OK)

        students_qs = Student.objects.select_related("current_class", "current_section", "guardian")
        if not request.user.is_superuser and request.user.school_id:
            students_qs = students_qs.filter(school_id=request.user.school_id)
        if class_id:
            multi_records = StudentMultiClassRecord.objects.filter(school_class_id=class_id)
            if section_id:
                multi_records = multi_records.filter(section_id=section_id)
            multi_student_ids = list(multi_records.values_list("student_id", flat=True).distinct())

            class_filter = Q(current_class_id=class_id)
            if section_id:
                class_filter &= Q(current_section_id=section_id)

            if multi_student_ids:
                students_qs = students_qs.filter(class_filter | Q(id__in=multi_student_ids)).distinct()
            else:
                students_qs = students_qs.filter(class_filter)
        elif section_id:
            students_qs = students_qs.filter(current_section_id=section_id)
        if admission_no:
            students_qs = students_qs.filter(admission_no__icontains=admission_no)
        if name:
            name_filter = Q(first_name__icontains=name) | Q(last_name__icontains=name)
            parts = [part for part in name.split(" ") if part]
            if len(parts) >= 2:
                first_name = parts[0]
                last_name = " ".join(parts[1:])
                name_filter |= Q(first_name__icontains=first_name, last_name__icontains=last_name)
            students_qs = students_qs.filter(name_filter)

        outstanding_qs = FeesAssignment.objects.filter(
            student_id__in=students_qs.values_list("id", flat=True),
        ).exclude(status=FeesAssignment.STATUS_PAID)
        due_rows = outstanding_qs.values("student_id").annotate(total_due=Sum("amount") - Sum("discount_amount"))
        due_map = {row["student_id"]: row["total_due"] for row in due_rows}

        student_role = None
        parent_role = None
        for role_row in self._role_queryset(request):
            if _is_student_role(role_row) and student_role is None:
                student_role = role_row
            if _is_parent_role(role_row) and parent_role is None:
                parent_role = role_row

        student_user_by_username = {}
        if student_role:
            student_user_roles = UserRole.objects.select_related("user", "role").filter(role_id=student_role.id)
            if not request.user.is_superuser and request.user.school_id:
                student_user_roles = student_user_roles.filter(
                    Q(role__school_id=request.user.school_id) | Q(role__school__isnull=True)
                )
            for user_role in student_user_roles:
                student_user_by_username[user_role.user.username] = user_role.user

        # PHP parity fallback: link by username even if role mapping rows are missing.
        admission_usernames = [str(v) for v in students_qs.values_list("admission_no", flat=True) if v]
        student_users_fallback = User.objects.filter(username__in=admission_usernames)
        if not request.user.is_superuser and request.user.school_id:
            student_users_fallback = student_users_fallback.filter(school_id=request.user.school_id)
        for user in student_users_fallback:
            student_user_by_username.setdefault(user.username, user)

        parent_user_by_phone = {}
        if parent_role:
            parent_user_roles = UserRole.objects.select_related("user", "role").filter(role_id=parent_role.id)
            if not request.user.is_superuser and request.user.school_id:
                parent_user_roles = parent_user_roles.filter(
                    Q(role__school_id=request.user.school_id) | Q(role__school__isnull=True)
                )
            for user_role in parent_user_roles:
                normalized = _normalize_phone(getattr(user_role.user, "phone", ""))
                if normalized:
                    parent_user_by_phone.setdefault(normalized, user_role.user)

        # Fallback: map parent by phone from all users when parent-role rows are unavailable.
        all_users_by_phone = User.objects.exclude(phone="")
        if not request.user.is_superuser and request.user.school_id:
            all_users_by_phone = all_users_by_phone.filter(school_id=request.user.school_id)
        for user in all_users_by_phone:
            normalized = _normalize_phone(getattr(user, "phone", ""))
            if normalized:
                parent_user_by_phone.setdefault(normalized, user)

        rows = []
        for student in students_qs:
            student_user = student_user_by_username.get(str(student.admission_no))
            guardian_phone = _normalize_phone(getattr(student.guardian, "phone", ""))
            parent_user = parent_user_by_phone.get(guardian_phone) if guardian_phone else None

            student_name = f"{(student.first_name or '').strip()} {(student.last_name or '').strip()}".strip()
            parent_name = ""
            if parent_user:
                parent_name = (
                    f"{(parent_user.first_name or '').strip()} {(parent_user.last_name or '').strip()}".strip()
                    or parent_user.username
                )

            rows.append(
                {
                    "admission_no": student.admission_no,
                    "roll_no": student.roll_no,
                    "student_name": student_name,
                    "class_name": student.current_class.name if student.current_class else "",
                    "section_name": student.current_section.name if student.current_section else "",
                    "due_amount": str(due_map.get(student.id) or "0"),
                    "student_user_id": student_user.id if student_user else None,
                    "student_access_status": bool(getattr(student_user, "due_fees_login_blocked", False)) if student_user else False,
                    "parent_name": parent_name,
                    "parent_user_id": parent_user.id if parent_user else None,
                    "parent_access_status": bool(getattr(parent_user, "due_fees_login_blocked", False)) if parent_user else False,
                }
            )

        return Response({"users": rows}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="toggle")
    def toggle(self, request):
        user_id = request.data.get("user_id") or request.data.get("id")
        if not user_id:
            return Response({"detail": "user_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        blocked = _coerce_bool(request.data.get("status"))
        user = User.objects.filter(id=user_id).first()
        if not user:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if not request.user.is_superuser and request.user.school_id and user.school_id != request.user.school_id:
            return Response({"detail": "User does not belong to your school."}, status=status.HTTP_403_FORBIDDEN)

        user.due_fees_login_blocked = blocked
        user.save(update_fields=["due_fees_login_blocked"])
        return Response(
            {"user_id": user.id, "due_fees_login_blocked": user.due_fees_login_blocked},
            status=status.HTTP_200_OK,
        )
