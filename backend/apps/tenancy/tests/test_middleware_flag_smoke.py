"""
Guards against the 2026-08-31 whole-backend outage: TenantMainMiddleware
(installed unconditionally in MIDDLEWARE as TenantContextMiddleware) called
connection.set_schema_to_public()/.set_schema() in process_request,
process_response, and process_exception. Only two of those three call sites
checked is_multi_tenancy_enabled() first — process_response and
process_exception did not, and both run on every single request regardless
of the flag. When MULTI_TENANCY_ENABLED is False the DB connection is plain
django.db.backends.postgresql, which has no such method, so every request
crashed with AttributeError -> 500.

CI runs this file twice (see .github/workflows/ci.yml, job
"tenancy-flag-matrix") — once with MULTI_TENANCY_ENABLED=true and once with
=false — so a regression in either configuration fails the build, instead
of only surfacing whenever someone happens to run the app in whichever
state their local machine isn't set to.
"""
import pytest
from django.test import Client


@pytest.mark.django_db
@pytest.mark.smoke
def test_public_path_survives_middleware():
    """A public/tenant-agnostic path (see PUBLIC_PATH_PREFIXES) must never
    500, in either MULTI_TENANCY_ENABLED state. This exercises
    TenantMainMiddleware's process_request "bypass" branch plus
    process_response on the way out."""
    response = Client().get("/api/v1/auth/me/")
    assert response.status_code != 500, (
        f"Middleware crashed with a 500 (got {response.status_code}) on a "
        "public path. Check apps/tenancy/middleware.py for a "
        "set_schema_to_public()/set_schema() call not guarded by "
        "is_multi_tenancy_enabled(), or a DB engine mismatched with the "
        "current MULTI_TENANCY_ENABLED setting."
    )


@pytest.mark.django_db
@pytest.mark.smoke
def test_unresolved_tenant_path_survives_middleware():
    """A path with no matching tenant/public-prefix must also never 500 —
    covers process_request's "no tenant resolved" branch, not just the
    explicit public-path bypass."""
    response = Client().get("/")
    assert response.status_code != 500, (
        f"Middleware crashed with a 500 (got {response.status_code}) on the "
        "root path."
    )
