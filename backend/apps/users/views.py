from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.mail import send_mail
from django.conf import settings
import random
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
    # Use standard JWTAuthentication (not TenantAware) — this endpoint runs
    # in the public-schema path where no tenant context is set.
    authentication_classes = [JWTAuthentication]
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
    # Use standard JWTAuthentication (not TenantAware) — this endpoint runs
    # in the public-schema path where no tenant context is set.
    authentication_classes = [JWTAuthentication]
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
    # Use standard JWTAuthentication (not TenantAware) — this endpoint runs
    # in the public-schema path where no tenant context is set.
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        old_password = (request.data.get("old_password") or "").strip()
        new_password = (request.data.get("new_password") or "").strip()

        if not old_password:
            return Response({"detail": "old_password is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not new_password:
            return Response({"detail": "new_password is required."}, status=status.HTTP_400_BAD_REQUEST)
        if len(new_password) < 6:
            return Response({"detail": "Password must be at least 6 characters."}, status=status.HTTP_400_BAD_REQUEST)
        if not user.check_password(old_password):
            return Response({"detail": "Current password is incorrect."}, status=status.HTTP_400_BAD_REQUEST)
        if old_password == new_password:
            return Response({"detail": "New password must be different from the current password."}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.must_change_password = False
        user.save(update_fields=["password", "must_change_password"])
        return Response({"ok": True, "message": "Password changed successfully."}, status=status.HTTP_200_OK)


User = get_user_model()
_OTP_TTL = 600  # 10 minutes
_OTP_KEY = "pwd_reset_otp_{email}"


class ForgotPasswordView(APIView):
    """
    POST /api/v1/auth/forgot-password/
    Body: { "email": "user@example.com" }
    Generates a 6-digit OTP, stores it in cache for 10 min, and emails it.
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        if not email:
            return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if not user:
            return Response(
                {"detail": "No account is registered with that email address."},
                status=status.HTTP_404_NOT_FOUND,
            )

        otp = str(random.randint(100000, 999999))
        cache.set(_OTP_KEY.format(email=email), otp, timeout=_OTP_TTL)

        from_email = settings.EMAIL_HOST_USER or settings.DEFAULT_FROM_EMAIL
        subject = "eSkoolia – Your Password Reset Code"
        message = (
            f"Hello {user.get_full_name() or user.username},\n\n"
            f"Your 6-digit password reset code is:\n\n"
            f"    {otp}\n\n"
            f"Enter this code on the reset page. It expires in 10 minutes.\n\n"
            f"If you did not request this, please ignore this email.\n\n"
            f"– The eSkoolia Team"
        )
        try:
            send_mail(subject, message, from_email, [user.email], fail_silently=False)
        except Exception as exc:
            import logging
            logging.getLogger(__name__).exception("SMTP error for %s", email)
            return Response(
                {"detail": f"Could not send email. Please try again later. ({exc})"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({"ok": True, "message": "Reset code sent to your email."}, status=status.HTTP_200_OK)


class VerifyResetCodeView(APIView):
    """
    POST /api/v1/auth/verify-reset-code/
    Body: { "email": "...", "code": "123456" }
    Validates the OTP without consuming it.
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        code = (request.data.get("code") or "").strip()

        if not email or not code:
            return Response({"detail": "email and code are required."}, status=status.HTTP_400_BAD_REQUEST)

        stored = cache.get(_OTP_KEY.format(email=email))
        if not stored or stored != code:
            return Response(
                {"detail": "Invalid or expired code. Please request a new one."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({"ok": True, "message": "Code verified."}, status=status.HTTP_200_OK)


class ResetPasswordView(APIView):
    """
    POST /api/v1/auth/reset-password/
    Body: { "email": "...", "code": "123456", "new_password": "..." }
    Validates OTP, resets password, then deletes OTP from cache.
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        code = (request.data.get("code") or "").strip()
        new_password = (request.data.get("new_password") or "").strip()

        if not email or not code or not new_password:
            return Response(
                {"detail": "email, code, and new_password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(new_password) < 6:
            return Response({"detail": "Password must be at least 6 characters."}, status=status.HTTP_400_BAD_REQUEST)

        stored = cache.get(_OTP_KEY.format(email=email))
        if not stored or stored != code:
            return Response(
                {"detail": "Invalid or expired code. Please request a new one."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if not user:
            return Response({"detail": "Invalid request."}, status=status.HTTP_400_BAD_REQUEST)

        if user.check_password(new_password):
            return Response(
                {"detail": "New password must be different from your current password."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.must_change_password = False
        user.save(update_fields=["password", "must_change_password"])
        cache.delete(_OTP_KEY.format(email=email))

        return Response({"ok": True, "message": "Password reset successfully."}, status=status.HTTP_200_OK)
