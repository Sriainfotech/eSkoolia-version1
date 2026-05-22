from django.contrib.auth.models import update_last_login
from django.db.models import Q
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User
from apps.tenancy.context import get_current_tenant, is_multi_tenancy_enabled


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

        # ── Tenant-scope check ────────────────────────────────────────────────
        # When on a school subdomain the authenticated user MUST belong to
        # that school. This blocks staff/admins from one school logging into
        # another school's portal even if their credentials are valid.
        if is_multi_tenancy_enabled() and not user.is_superuser:
            current_tenant = get_current_tenant()
            if current_tenant is not None:
                user_school_id = getattr(user, 'school_id', None)
                if not user_school_id:
                    raise AuthenticationFailed(
                        "Your account is not assigned to any school. "
                        "Please contact your administrator."
                    )
                try:
                    from apps.tenancy.models import School
                    user_school = School.objects.filter(id=user_school_id).first()
                    if user_school is None:
                        raise AuthenticationFailed(
                            "School record not found for this account."
                        )
                    subdomain_url = (current_tenant.subdomain_url or "").lower()
                    school_matches = (
                        (user_school.subdomain or "").lower() == subdomain_url
                        or (user_school.code or "").lower() == subdomain_url
                        or (user_school.name or "").lower()
                            == (current_tenant.name or "").lower()
                    )
                    if not school_matches:
                        raise AuthenticationFailed(
                            "Invalid credentials for this school portal."
                        )
                except AuthenticationFailed:
                    raise
                except Exception:
                    raise AuthenticationFailed(
                        "Unable to verify school membership. Please try again."
                    )
        # ─────────────────────────────────────────────────────────────────────

        refresh = self.get_token(user)
        update_last_login(None, user)  # keep last_login accurate for the Login Permission UI

        # Resolve tenant context for subdomain-based frontend routing.
        school_code = None
        tenant_id = None
        if user and not user.is_superuser and getattr(user, "school_id", None):
            try:
                from apps.tenancy.models import SchoolTenant, Domain
                # Look up a Domain whose subdomain maps to this school's name.
                # SchoolTenant.name stores the school's full name; match via the
                # School record linked to the user.
                from apps.tenancy.models import School
                school = School.objects.filter(id=user.school_id).first()
                if school:
                    # Find a tenant whose Domain subdomain matches by school name
                    tenant = SchoolTenant.objects.filter(name__iexact=school.name).first()
                    if not tenant:
                        # Fallback: match by school.code against subdomain_url
                        tenant = SchoolTenant.objects.filter(
                            subdomain_url__iexact=school.code
                        ).first()
                    if tenant:
                        school_code = tenant.subdomain_url   # e.g. "springdale"
                        tenant_id = tenant.tenant_id          # e.g. "SCH-001"
            except Exception:
                pass  # Never block login due to tenant lookup failure

        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "school_code": school_code,
            "tenant_id": tenant_id,
            "is_super_admin": bool(user.is_superuser),
        }
