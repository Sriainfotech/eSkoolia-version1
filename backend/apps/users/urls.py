from django.urls import path
from .views import (
    ChangePasswordView, ForgotPasswordView, HealthView,
    LoginView, LogoutView, MeView, RefreshView,
    ResetPasswordView, VerifyResetCodeView,
)

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", RefreshView.as_view(), name="refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="forgot-password"),
    path("verify-reset-code/", VerifyResetCodeView.as_view(), name="verify-reset-code"),
    path("reset-password/", ResetPasswordView.as_view(), name="reset-password"),
]
