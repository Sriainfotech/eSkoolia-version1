from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .serializers import LoginTokenObtainPairSerializer


class HealthView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response({"status": "ok", "service": "backend"})


class LoginView(TokenObtainPairView):
    serializer_class = LoginTokenObtainPairSerializer


class RefreshView(TokenRefreshView):
    pass


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response({"detail": "Refresh token is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            return Response({"detail": "Invalid refresh token."}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"detail": "Logout successful."}, status=status.HTTP_200_OK)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        role_rows = user.user_roles.select_related("role").all()
        role_names = [row.role.name for row in role_rows if row.role]
        role_ids = [row.role_id for row in role_rows if row.role_id]

        return Response(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "school_id": user.school_id,
                "is_superuser": bool(user.is_superuser),
                "is_school_admin": bool(getattr(user, "is_school_admin", False)),
                "role_ids": role_ids,
                "role_names": role_names,
                "permission_codes": sorted(user.get_permission_codes()),
                "must_change_password": bool(getattr(user, "must_change_password", False)),
            },
            status=status.HTTP_200_OK,
        )


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        new_password = (request.data.get("new_password") or "").strip()

        if not new_password:
            return Response({"detail": "new_password is required."}, status=status.HTTP_400_BAD_REQUEST)
        if len(new_password) < 6:
            return Response({"detail": "Password must be at least 6 characters."}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.must_change_password = False
        user.save(update_fields=["password", "must_change_password"])
        return Response({"ok": True, "message": "Password changed successfully."}, status=status.HTTP_200_OK)
