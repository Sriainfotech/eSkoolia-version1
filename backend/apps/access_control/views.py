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

from .models import AccessTier, ModuleAccessTier, Permission, Role, RoleModuleAccess, RoleTemplate, UserRole
from .permission_classes import CanManageRoles, CanManageUserRoles, CanViewPermissions
from .serializers import PermissionSerializer, RoleMinimalSerializer, RoleSerializer, UserRoleSerializer
from .services import apply_template_to_role, infer_tier_for_role_module, sync_role_module_permissions
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

    def get_serializer_class(self):
        if self.action == "list" and self.request.query_params.get("minimal") == "1":
            return RoleMinimalSerializer
        return RoleSerializer

    def get_queryset(self):
        user = self.request.user
        minimal = self.action == "list" and self.request.query_params.get("minimal") == "1"
        queryset = Role.objects.all() if minimal else Role.objects.prefetch_related("permissions")
        if user.is_superuser:
            pass
        elif user.school_id:
            queryset = queryset.filter(school_id=user.school_id)
        else:
            queryset = queryset.filter(school__isnull=True)

        # For list action: only return active roles by default; pass ?show_inactive=1 to include all.
        # Detail/update/destroy actions must reach inactive roles (e.g. to re-activate them).
        if self.action == "list" and self.request.query_params.get("show_inactive") != "1":
            queryset = queryset.filter(is_active=True)

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
            raise ValidationError({"name": "A role with this name already exists."})

    def perform_update(self, serializer):
        try:
            serializer.save()
        except IntegrityError:
            raise ValidationError({"name": "A role with this name already exists."})

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

    @action(detail=True, methods=["get", "post"], url_path="module-access")
    def module_access(self, request, pk=None):
        """
        GET  → returns current tier for every known module for this role.
        POST → { "module": "fees", "tier": "view" }
               Sets the tier and syncs RolePermission rows for that module.
        """
        role = self.get_object()

        if request.method == "GET":
            known_modules = list(
                ModuleAccessTier.objects.values_list("module", flat=True).distinct()
            )
            existing = {
                rma.module: rma.tier
                for rma in RoleModuleAccess.objects.filter(role=role)
            }
            result = []
            for module in sorted(set(known_modules)):
                tier = existing.get(module, AccessTier.NONE)
                tier_counts = {}
                for mat in ModuleAccessTier.objects.filter(module=module):
                    tier_counts[mat.tier] = mat.permissions.count()
                result.append({
                    "module": module,
                    "tier": tier,
                    "tier_counts": tier_counts,
                })
            return self.success_response("Module access retrieved.", result)

        # POST
        module = (request.data.get("module") or "").strip()
        tier = request.data.get("tier", AccessTier.NONE)
        if not module:
            return self.error_response("module is required.", status.HTTP_400_BAD_REQUEST)
        valid_tiers = [t[0] for t in AccessTier.choices]
        if tier not in valid_tiers:
            return self.error_response(f"Invalid tier '{tier}'.", status.HTTP_400_BAD_REQUEST)

        rma, _ = RoleModuleAccess.objects.update_or_create(
            role=role, module=module, defaults={"tier": tier}
        )
        sync_role_module_permissions(rma)
        return self.success_response(
            f"Module '{module}' tier set to '{tier}' and permissions synced.",
            {"module": module, "tier": tier},
        )

    @action(detail=True, methods=["post"], url_path="apply-template")
    def apply_template(self, request, pk=None):
        """
        POST { "template_id": 3 }
        Applies a RoleTemplate's module_tiers to this role.
        """
        role = self.get_object()
        template_id = request.data.get("template_id")
        try:
            template = RoleTemplate.objects.get(pk=template_id)
        except RoleTemplate.DoesNotExist:
            return self.error_response("Template not found.", status.HTTP_404_NOT_FOUND)

        apply_template_to_role(role, template)
        return self.success_response(
            f"Template '{template.name}' applied to role '{role.name}'.",
            {"template": template.name, "applied_modules": list(template.module_tiers.keys())},
        )

    @action(detail=True, methods=["get"], url_path="module-access/infer")
    def infer_module_access(self, request, pk=None):
        """
        GET → Infers tiers from existing RolePermission rows.
        Returns suggested tiers without writing anything.
        """
        role = self.get_object()
        modules = list(
            ModuleAccessTier.objects.values_list("module", flat=True).distinct()
        )
        suggestions = []
        for module in sorted(set(modules)):
            inferred = infer_tier_for_role_module(role, module)
            suggestions.append({"module": module, "suggested_tier": inferred})
        return self.success_response("Tier inference complete.", suggestions)


class RoleTemplateViewSet(StandardizedAccessControlResponseMixin, viewsets.ReadOnlyModelViewSet):
    """Read-only list of available role templates for the Apply Template dropdown."""
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return RoleTemplate.objects.all()

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        data = [{"id": t.id, "name": t.name, "description": t.description} for t in qs]
        return self.success_response("Templates retrieved.", data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        return self.success_response(
            "Template retrieved.",
            {"id": instance.id, "name": instance.name, "description": instance.description, "module_tiers": instance.module_tiers},
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


class LoginPermissionViewSet(viewsets.ViewSet):
    """
    Dedicated API for the Login Permission management page.
    Uses camelCase JSON keys to match the frontend TypeScript interfaces directly.
    """

    permission_classes = [permissions.IsAuthenticated, CanManageUserRoles]

    def _roles_qs(self, request):
        qs = Role.objects.order_by("name")
        if request.user.is_superuser:
            return qs
        if request.user.school_id:
            return qs.filter(Q(school_id=request.user.school_id) | Q(school__isnull=True))
        return Role.objects.none()

    def _get_role_by_slug(self, request, role_slug: str):
        """Find a Role by name, matching case-insensitively (e.g. 'student' → 'Student')."""
        slug = (role_slug or "").strip().lower()
        if not slug:
            return None
        # Exact match first
        for role in self._roles_qs(request):
            if (role.name or "").lower() == slug:
                return role
        # Fallback: contains match
        for role in self._roles_qs(request):
            if slug in (role.name or "").lower():
                return role
        return None

    def list(self, request):
        """GET /login-permission/ — returns meta (same as /meta/ action)."""
        return self._meta_response(request)

    @action(detail=False, methods=["get"], url_path="meta")
    def meta(self, request):
        return self._meta_response(request)

    def _meta_response(self, request):
        classes_qs = Class.objects.order_by("numeric_order", "name")
        sections_qs = Section.objects.select_related("school_class").order_by("name")
        if not request.user.is_superuser and request.user.school_id:
            classes_qs = classes_qs.filter(school_id=request.user.school_id)
            sections_qs = sections_qs.filter(school_class__school_id=request.user.school_id)

        roles = []
        for r in self._roles_qs(request):
            if _is_parent_role(r):
                continue
            roles.append({"id": str(r.id), "name": r.name, "isStudent": _is_student_role(r)})

        classes = [{"id": str(c.id), "name": c.name} for c in classes_qs]
        sections = [{"id": str(s.id), "name": s.name, "classId": str(s.school_class_id)} for s in sections_qs]
        return Response({"roles": roles, "classes": classes, "sections": sections}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="users")
    def users(self, request):
        role_slug = (request.query_params.get("role") or "").strip()
        class_id = request.query_params.get("class_id") or request.query_params.get("class")
        section_id = request.query_params.get("section_id") or request.query_params.get("section")
        search = (request.query_params.get("search") or "").strip()
        status_filter = (request.query_params.get("status") or "all").strip()

        try:
            page_num = max(1, int(request.query_params.get("page", 1)))
        except (ValueError, TypeError):
            page_num = 1
        try:
            page_size = min(200, max(1, int(request.query_params.get("page_size", 25))))
        except (ValueError, TypeError):
            page_size = 25

        if not role_slug:
            return Response({"detail": "role query param is required."}, status=status.HTTP_400_BAD_REQUEST)

        role = self._get_role_by_slug(request, role_slug)
        if not role:
            return Response({"detail": f"No role matching '{role_slug}' found."}, status=status.HTTP_404_NOT_FOUND)

        is_student = _is_student_role(role)

        # ── Student path ──────────────────────────────────────────────────────
        if is_student:
            students_qs = Student.objects.select_related(
                "current_class", "current_section"
            ).filter(is_deleted=False)
            if not request.user.is_superuser and request.user.school_id:
                students_qs = students_qs.filter(school_id=request.user.school_id)
            # Class and section are optional filters
            if class_id:
                students_qs = students_qs.filter(current_class_id=class_id)
            if section_id:
                students_qs = students_qs.filter(current_section_id=section_id)
            if search:
                students_qs = students_qs.filter(
                    Q(first_name__icontains=search)
                    | Q(last_name__icontains=search)
                    | Q(admission_no__icontains=search)
                )
            students_qs = students_qs.order_by("first_name", "last_name")

            admission_nos = [str(s.admission_no) for s in students_qs if s.admission_no]
            existing_users = {}
            if admission_nos:
                qs_users = User.objects.filter(username__in=admission_nos)
                if not request.user.is_superuser and request.user.school_id:
                    qs_users = qs_users.filter(school_id=request.user.school_id)
                existing_users = {u.username: u for u in qs_users}

            raw_users = []
            for student in students_qs:
                username_val = str(student.admission_no or "").strip()
                if not username_val:
                    continue

                user_obj = existing_users.get(username_val)
                if user_obj is None:
                    user_obj = User.objects.filter(username=username_val).first()
                if user_obj is None:
                    user_obj = User(
                        username=username_val,
                        first_name=(student.first_name or "").strip(),
                        last_name=(student.last_name or "").strip(),
                        school_id=student.school_id,
                        access_status=True,
                    )
                    user_obj.set_password("123456")
                    user_obj.save()
                    if not UserRole.objects.filter(user_id=user_obj.id, role_id=role.id).exists():
                        UserRole.objects.create(user_id=user_obj.id, role_id=role.id)
                    existing_users[username_val] = user_obj

                class_name = student.current_class.name if student.current_class else ""
                section_name = student.current_section.name if student.current_section else ""
                full_name = f"{(student.first_name or '').strip()} {(student.last_name or '').strip()}".strip() or username_val

                raw_users.append({
                    "id": str(user_obj.id),
                    "staffId": student.admission_no or username_val,
                    "name": full_name,
                    "role": f"{role.name} · {class_name}-{section_name}" if class_name else role.name,
                    "email": user_obj.email or student.email or "",
                    "loginAccess": bool(getattr(user_obj, "access_status", True)),
                    "lastLogin": user_obj.last_login.isoformat() if user_obj.last_login else None,
                    "mustChange": bool(getattr(user_obj, "must_change_password", False)),
                })

        # ── Non-student path ──────────────────────────────────────────────────
        else:
            user_role_qs = UserRole.objects.select_related("user", "role").filter(role_id=role.id)
            if not request.user.is_superuser and request.user.school_id:
                user_role_qs = user_role_qs.filter(
                    Q(role__school_id=request.user.school_id) | Q(role__school__isnull=True)
                )
            if search:
                user_role_qs = user_role_qs.filter(
                    Q(user__first_name__icontains=search)
                    | Q(user__last_name__icontains=search)
                    | Q(user__username__icontains=search)
                    | Q(user__email__icontains=search)
                )

            user_ids = list(user_role_qs.values_list("user_id", flat=True).distinct())
            staff_map = {
                row.user_id: row
                for row in Staff.objects.filter(user_id__in=user_ids).only("user_id", "staff_no")
            }

            seen = set()
            raw_users = []
            for ur in user_role_qs.select_related("user").order_by("user__first_name", "user__last_name"):
                if ur.user_id in seen:
                    continue
                seen.add(ur.user_id)
                u = ur.user
                staff = staff_map.get(u.id)
                full_name = (
                    f"{(u.first_name or '').strip()} {(u.last_name or '').strip()}".strip()
                    or u.username
                )
                raw_users.append({
                    "id": str(u.id),
                    "staffId": staff.staff_no if staff else u.username,
                    "name": full_name,
                    "role": role.name,
                    "email": u.email or "",
                    "loginAccess": bool(getattr(u, "access_status", True)),
                    "lastLogin": u.last_login.isoformat() if u.last_login else None,
                    "mustChange": bool(getattr(u, "must_change_password", False)),
                })

        # ── Apply status filter ───────────────────────────────────────────────
        if status_filter == "active":
            raw_users = [u for u in raw_users if u["loginAccess"]]
        elif status_filter == "inactive":
            raw_users = [u for u in raw_users if not u["loginAccess"]]
        elif status_filter == "new":
            raw_users = [u for u in raw_users if u["lastLogin"] is None]

        # ── Counts & pagination ───────────────────────────────────────────────
        total = len(raw_users)
        counts = {
            "total": total,
            "active": sum(1 for u in raw_users if u["loginAccess"]),
            "disabled": sum(1 for u in raw_users if not u["loginAccess"]),
        }
        start = (page_num - 1) * page_size
        paginated = raw_users[start: start + page_size]
        total_pages = max(1, (total + page_size - 1) // page_size) if total > 0 else 0

        return Response(
            {
                "results": paginated,
                "page": page_num,
                "pageSize": page_size,
                "totalPages": total_pages,
                "filteredCount": total,
                "counts": counts,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="toggle")
    def toggle(self, request):
        user_id = request.data.get("id") or request.data.get("user_id")
        if not user_id:
            return Response({"detail": "id is required."}, status=status.HTTP_400_BAD_REQUEST)
        login_access = _coerce_bool(request.data.get("loginAccess", request.data.get("login_access")))

        user_obj = User.objects.filter(id=user_id).first()
        if not user_obj:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        if not request.user.is_superuser and request.user.school_id and user_obj.school_id != request.user.school_id:
            return Response({"detail": "Unauthorized."}, status=status.HTTP_403_FORBIDDEN)

        user_obj.access_status = login_access
        user_obj.save(update_fields=["access_status"])
        return Response({"id": str(user_obj.id), "loginAccess": user_obj.access_status}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="reset-password")
    def reset_password(self, request):
        import secrets
        import string as _string

        user_id = request.data.get("id") or request.data.get("user_id")
        if not user_id:
            return Response({"detail": "id is required."}, status=status.HTTP_400_BAD_REQUEST)

        user_obj = User.objects.filter(id=user_id).first()
        if not user_obj:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        if not request.user.is_superuser and request.user.school_id and user_obj.school_id != request.user.school_id:
            return Response({"detail": "Unauthorized."}, status=status.HTTP_403_FORBIDDEN)

        alphabet = _string.ascii_letters + _string.digits
        temp_password = "".join(secrets.choice(alphabet) for _ in range(10))
        user_obj.set_password(temp_password)
        user_obj.save(update_fields=["password"])

        return Response(
            {
                "ok": True,
                "passwordBackup": temp_password,
                "message": "Password reset successfully.",
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="bulk-access")
    def bulk_access(self, request):
        ids = request.data.get("ids") or []
        all_matching = _coerce_bool(request.data.get("allMatching", False))
        login_access = _coerce_bool(request.data.get("login_access", request.data.get("loginAccess", False)))
        role_slug = (request.data.get("role") or "").strip()
        search = (request.data.get("search") or "").strip()

        if all_matching and role_slug:
            role = self._get_role_by_slug(request, role_slug)
            if role:
                user_ids_qs = UserRole.objects.filter(role_id=role.id).values_list("user_id", flat=True).distinct()
                target_qs = User.objects.filter(id__in=user_ids_qs)
                if not request.user.is_superuser and request.user.school_id:
                    target_qs = target_qs.filter(school_id=request.user.school_id)
                if search:
                    target_qs = target_qs.filter(
                        Q(first_name__icontains=search)
                        | Q(last_name__icontains=search)
                        | Q(username__icontains=search)
                    )
                affected = target_qs.update(access_status=login_access)
                return Response({"affected": affected}, status=status.HTTP_200_OK)
        elif ids:
            safe_ids = [int(i) for i in ids if str(i).lstrip("-").isdigit()]
            affected = User.objects.filter(id__in=safe_ids).update(access_status=login_access)
            return Response({"affected": affected}, status=status.HTTP_200_OK)

        return Response({"affected": 0}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="bulk-reset")
    def bulk_reset(self, request):
        import secrets
        import string as _string

        ids = request.data.get("ids") or []
        all_matching = _coerce_bool(request.data.get("allMatching", False))
        role_slug = (request.data.get("role") or "").strip()
        search = (request.data.get("search") or "").strip()

        alphabet = _string.ascii_letters + _string.digits

        def gen_pwd():
            return "".join(secrets.choice(alphabet) for _ in range(10))

        if all_matching and role_slug:
            role = self._get_role_by_slug(request, role_slug)
            if role:
                user_ids = list(
                    UserRole.objects.filter(role_id=role.id).values_list("user_id", flat=True).distinct()
                )
                target_qs = User.objects.filter(id__in=user_ids)
                if not request.user.is_superuser and request.user.school_id:
                    target_qs = target_qs.filter(school_id=request.user.school_id)
                if search:
                    target_qs = target_qs.filter(
                        Q(first_name__icontains=search)
                        | Q(last_name__icontains=search)
                        | Q(username__icontains=search)
                    )
                count = 0
                for u in target_qs:
                    u.set_password(gen_pwd())
                    u.save(update_fields=["password"])
                    count += 1
                return Response({"affected": count}, status=status.HTTP_200_OK)
        elif ids:
            safe_ids = [int(i) for i in ids if str(i).lstrip("-").isdigit()]
            count = 0
            for u in User.objects.filter(id__in=safe_ids):
                u.set_password(gen_pwd())
                u.save(update_fields=["password"])
                count += 1
            return Response({"affected": count}, status=status.HTTP_200_OK)

        return Response({"affected": 0}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="set-initial-password")
    def set_initial_password(self, request):
        user_id = request.data.get("id") or request.data.get("user_id")
        mode = (request.data.get("mode") or "default").strip().lower()
        manual_password = (request.data.get("password") or "").strip()

        if not user_id:
            return Response({"detail": "id is required."}, status=status.HTTP_400_BAD_REQUEST)

        user_obj = User.objects.filter(id=user_id).first()
        if not user_obj:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        if not request.user.is_superuser and request.user.school_id and user_obj.school_id != request.user.school_id:
            return Response({"detail": "Unauthorized."}, status=status.HTTP_403_FORBIDDEN)
        if user_obj.last_login:
            return Response(
                {"detail": "This user has already logged in. Use Reset Password instead."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if mode == "default":
            final_password = "123456"
        elif mode == "manual":
            if not manual_password:
                return Response({"detail": "password is required for manual mode."}, status=status.HTTP_400_BAD_REQUEST)
            if len(manual_password) < 6:
                return Response({"detail": "Password must be at least 6 characters."}, status=status.HTTP_400_BAD_REQUEST)
            final_password = manual_password
        else:
            return Response({"detail": "Invalid mode. Use 'default' or 'manual'."}, status=status.HTTP_400_BAD_REQUEST)

        # Use set_password() to store a proper hash — never assign plain text.
        user_obj.set_password(final_password)
        user_obj.must_change_password = True

        # Ensure the account is active so the user can actually log in.
        fields_to_update = ["password", "must_change_password"]
        if not user_obj.is_active:
            user_obj.is_active = True
            fields_to_update.append("is_active")
        if not getattr(user_obj, "access_status", True):
            user_obj.access_status = True
            fields_to_update.append("access_status")

        user_obj.save(update_fields=fields_to_update)

        return Response(
            {
                "ok": True,
                "passwordBackup": final_password,
                "message": "Initial password set. The user must change it on first login.",
            },
            status=status.HTTP_200_OK,
        )
