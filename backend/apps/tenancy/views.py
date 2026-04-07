from rest_framework import permissions, viewsets
from rest_framework.exceptions import PermissionDenied

from .models import School
from .serializers import SchoolSerializer


class SchoolViewSet(viewsets.ModelViewSet):
    serializer_class = SchoolSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _require_admin(self):
        user = self.request.user
        if not (user.is_superuser or getattr(user, "is_school_admin", False)):
            raise PermissionDenied("You do not have permission to manage schools.")

    def get_queryset(self):
        self._require_admin()
        user = self.request.user
        queryset = School.objects.all().order_by("name")
        if user.is_superuser:
            return queryset
        if user.school_id:
            return queryset.filter(id=user.school_id)
        return queryset.none()

    def perform_create(self, serializer):
        user = self.request.user
        if not user.is_superuser:
            raise PermissionDenied("Only superusers can add schools.")
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        if not user.is_superuser:
            raise PermissionDenied("Only superusers can delete schools.")
        super().perform_destroy(instance)
