from django.contrib.auth.models import update_last_login
from django.db.models import Q
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "phone",
            "school",
            "is_school_admin",
            "access_status",
            "due_fees_login_blocked",
        ]

    def validate(self, attrs):
        qs = User.objects.all()
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        username = attrs.get("username")
        email = attrs.get("email")
        phone = attrs.get("phone")
        if username and qs.filter(username__iexact=username).exists():
            raise serializers.ValidationError({"username": "Username already exists."})
        if email and qs.filter(email__iexact=email).exists():
            raise serializers.ValidationError({"email": "Email already exists."})
        if phone and qs.filter(phone__iexact=phone).exists():
            raise serializers.ValidationError({"phone": "Phone already exists."})
        return attrs


class LoginTokenObtainPairSerializer(TokenObtainPairSerializer):
    # Keep request contract compatible with current frontend which posts "username" and "password".
    def validate(self, attrs):
        login_value = (attrs.get("username") or "").strip()
        password = attrs.get("password") or ""

        if not login_value or not password:
            raise AuthenticationFailed("Username and password are required.")

        candidates = User.objects.filter(
            Q(username__iexact=login_value) | Q(email__iexact=login_value) | Q(phone__iexact=login_value)
        ).order_by("id")

        # Support full-name login (e.g. "First Last") for legacy/ERP-style usage.
        if not candidates.exists() and " " in login_value:
            parts = [part for part in login_value.split(" ") if part]
            if len(parts) >= 2:
                first_name = parts[0]
                last_name = " ".join(parts[1:])
                candidates = User.objects.filter(
                    first_name__iexact=first_name,
                    last_name__iexact=last_name,
                ).order_by("id")

        user = None
        blocked_reason = None
        for candidate in candidates:
            if not candidate.check_password(password):
                continue

            # Only enforce login flags for accounts with a matching password.
            if not candidate.is_active:
                blocked_reason = "This account is inactive."
                continue

            if not getattr(candidate, "access_status", True):
                blocked_reason = "Login is blocked for this account."
                continue

            if getattr(candidate, "due_fees_login_blocked", False):
                blocked_reason = "Login is blocked due to pending fees."
                continue

            user = candidate
            break

        if blocked_reason and not user:
            raise AuthenticationFailed(blocked_reason)

        if candidates.exists() and not user:
            raise AuthenticationFailed("Invalid password.")

        if not user:
            raise AuthenticationFailed("No account was found for the provided username, email, phone, or name.")

        refresh = self.get_token(user)
        update_last_login(None, user)  # keep last_login accurate for the Login Permission UI
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }
