from rest_framework.routers import DefaultRouter
from .views import (
	DueFeesLoginPermissionViewSet,
	LoginAccessControlViewSet,
	LoginPermissionViewSet,
	PermissionViewSet,
	RoleTemplateViewSet,
	RoleViewSet,
	UserRoleViewSet,
)

router = DefaultRouter()
router.register("permissions", PermissionViewSet, basename="permission")
router.register("roles", RoleViewSet, basename="role")
router.register("user-roles", UserRoleViewSet, basename="user-role")
router.register("login-access-control", LoginAccessControlViewSet, basename="login-access-control")
router.register("login-permission", LoginPermissionViewSet, basename="login-permission")
router.register("due-fees-login-permission", DueFeesLoginPermissionViewSet, basename="due-fees-login-permission")
router.register("role-templates", RoleTemplateViewSet, basename="role-template")

urlpatterns = router.urls
