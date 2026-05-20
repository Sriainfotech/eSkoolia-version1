import logging

from django.apps import apps
from django.conf import settings
from django.core.checks import Error, Warning, register

from .utils import validate_tenancy_configuration

logger = logging.getLogger(__name__)


@register()
def tenancy_middleware_and_config_checks(app_configs, **kwargs):
    from .utils import _validate_staging_activation_readiness

    report = validate_tenancy_configuration()
    messages = []

    # Handle None return value gracefully
    if report is None:
        logger.warning("validate_tenancy_configuration() returned None; using default safe state")
        return []

    if not report.get("enabled"):
        logger.info("Tenancy middleware validation running in inactive mode because MULTI_TENANCY_ENABLED is False")
    else:
        logger.info("Tenancy middleware validation running with MULTI_TENANCY_ENABLED=True")

    warnings_map = {
        "tenancy.W001": "TenantMainMiddleware is missing from MIDDLEWARE.",
        "tenancy.W002": "TenantMainMiddleware should be the first middleware when tenant routing is enabled.",
        "tenancy.W003": "SessionMiddleware should remain ahead of TenantMainMiddleware for safe compatibility checks.",
        "tenancy.W004": "DATABASE_ROUTERS is empty; tenant routing remains inactive until a router is configured.",
        "tenancy.W005": "Tenant model configuration is incomplete or tenant models cannot be imported.",
        "tenancy.W006": "JWTAuthentication is not configured in REST_FRAMEWORK; verify auth compatibility.",
        "tenancy.W007": "Tenant router is missing or not first in DATABASE_ROUTERS.",
        "tenancy.W008": "SHARED_APPS/TENANT_APPS separation is missing or incomplete.",
        "tenancy.W009": "A tenant app appears in SHARED_APPS or a shared app appears in TENANT_APPS.",
        "tenancy.W010": "Staging activation detected but prerequisites are incomplete; review blockers.",
    }

    error_map = {
        "tenancy.E001": "AuthenticationMiddleware must appear after TenantMainMiddleware.",
        "tenancy.E002": "Tenant model inheritance or readiness validation failed.",
        "tenancy.E003": "Router activation enabled but app split is incomplete; cannot safely enable tenant routing.",
        "tenancy.E004": "Duplicate apps found in SHARED_APPS and TENANT_APPS; cannot proceed with routing.",
        "tenancy.E005": "Middleware ordering conflict prevents safe tenant routing activation.",
        "tenancy.E006": "Tenancy migration state does not match the physical database schema.",
    }

    for item in report.get("middleware", {}).get("warnings", []):
        if "TenantMainMiddleware is missing" in item:
            messages.append(Warning(warnings_map["tenancy.W001"], id="tenancy.W001"))
        elif "should be first" in item:
            messages.append(Warning(warnings_map["tenancy.W002"], id="tenancy.W002"))
        elif "SessionMiddleware" in item:
            messages.append(Warning(warnings_map["tenancy.W003"], id="tenancy.W003"))
        elif "JWTAuthentication" in item:
            messages.append(Warning(warnings_map["tenancy.W006"], id="tenancy.W006"))

    for item in report.get("routers", {}).get("warnings", []):
        if "empty" in item:
            messages.append(Warning(warnings_map["tenancy.W004"], id="tenancy.W004"))
        else:
            messages.append(Warning(warnings_map["tenancy.W007"], id="tenancy.W007"))

    for item in report.get("models", {}).get("warnings", []):
        messages.append(Warning(item, id="tenancy.W005"))

    for item in report.get("apps", {}).get("warnings", []):
        messages.append(Warning(warnings_map["tenancy.W008"], id="tenancy.W008"))
    
    for item in report.get("apps", {}).get("errors", []):
        messages.append(Error(warnings_map["tenancy.W009"], id="tenancy.E004"))

    for item in report.get("middleware", {}).get("errors", []):
        messages.append(Error(error_map["tenancy.E001"], id="tenancy.E001"))

    for item in report.get("schema", {}).get("warnings", []):
        messages.append(Warning(item, id="tenancy.W011"))

    for item in report.get("schema", {}).get("errors", []):
        messages.append(Error(error_map["tenancy.E006"], id="tenancy.E006"))

    # Only check model errors if tenancy is enabled
    if report.get("enabled"):
        if not report.get("ok", True):
            messages.append(Error(error_map["tenancy.E002"], id="tenancy.E002"))

        # Check staging activation readiness only when enabled
        staging_report = _validate_staging_activation_readiness()
        
        if staging_report.get("blockers"):
            msg = f"Staging activation detected but {len(staging_report['blockers'])} blocker(s) found: {'; '.join(staging_report['blockers'][:3])}"
            if len(staging_report["blockers"]) > 3:
                msg += f" ... and {len(staging_report['blockers']) - 3} more"
            messages.append(Warning(msg, id="tenancy.W010"))

        if staging_report.get("app_split", {}).get("overlap"):
            messages.append(Error(error_map["tenancy.E004"], id="tenancy.E004"))

    logger.info(
        "Tenancy middleware validation result: warnings=%d errors=%d",
        sum(isinstance(m, Warning) for m in messages),
        sum(isinstance(m, Error) for m in messages),
    )
    return messages
