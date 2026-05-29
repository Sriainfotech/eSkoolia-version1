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

        # ── Tenant-status check (suspended/inactive schools) ─────────────────
        # Block login for any non-superuser whose target tenant is not in an
        # active/trial status. Try the request-derived tenant first (subdomain
        # or X-Tenant header) so suspension applies even if the user→school
        # lookup below fails.
        def _is_blocked_status(t) -> bool:
            return (getattr(t, "status", "") or "").lower() not in ("active", "trial")

        request_tenant = None
        if not user.is_superuser:
            try:
                request = self.context.get("request") if hasattr(self, "context") else None
                if request is not None:
                    from apps.tenancy.resolvers import get_tenant_from_request
                    request_tenant = get_tenant_from_request(request)
            except Exception:
                request_tenant = None

            if request_tenant is not None and _is_blocked_status(request_tenant):
                raise AuthenticationFailed(
                    "Login is disabled for this school. "
                    "Please contact your administrator."
                )
        # ─────────────────────────────────────────────────────────────────────

        # Resolve tenant context for subdomain-based frontend routing.
        school_code = None
        tenant_id = None
        if user and not user.is_superuser and getattr(user, "school_id", None):
            tenant = None
            try:
                from apps.tenancy.models import SchoolTenant, School
                school = School.objects.filter(id=user.school_id).first()
                if school:
                    name = (school.name or "").strip()
                    code = (school.code or "").strip()
                    subdomain = (school.subdomain or "").strip()
                    q = Q()
                    if name:
                        q |= Q(name__iexact=name)
                    if code:
                        q |= Q(subdomain_url__iexact=code) | Q(short_code__iexact=code)
                    if subdomain:
                        q |= Q(subdomain_url__iexact=subdomain)
                    if q:
                        tenant = SchoolTenant.objects.filter(q).first()
            except AuthenticationFailed:
                raise
            except Exception:
                tenant = None  # Never block login due to tenant lookup failure

            if tenant is not None:
                if _is_blocked_status(tenant):
                    raise AuthenticationFailed(
                        "Login is disabled for this school. "
                        "Please contact your administrator."
                    )
                school_code = tenant.subdomain_url
                tenant_id = tenant.tenant_id

        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "school_code": school_code,
            "tenant_id": tenant_id,
            "is_super_admin": bool(user.is_superuser),
        }
