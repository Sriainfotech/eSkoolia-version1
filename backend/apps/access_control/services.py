"""
Tier sync service.
Called whenever a RoleModuleAccess is saved to keep RolePermission in sync.
"""
from .models import AccessTier, ModuleAccessTier, RoleModuleAccess, RolePermission


def sync_role_module_permissions(role_module_access: RoleModuleAccess) -> None:
    """
    Given a RoleModuleAccess record, replace all RolePermission rows for
    (role, module) with exactly the permissions that correspond to the chosen tier.

    - If tier is NONE: delete all RolePermission rows for this role+module.
    - Otherwise: get the ModuleAccessTier for (module, tier), replace all
      RolePermission rows for this role+module with those permissions.
    """
    role = role_module_access.role
    module = role_module_access.module
    tier = role_module_access.tier

    # Remove all existing permissions for this role+module
    RolePermission.objects.filter(
        role=role,
        permission__module=module,
    ).delete()

    if tier == AccessTier.NONE:
        return

    try:
        tier_config = ModuleAccessTier.objects.prefetch_related("permissions").get(
            module=module, tier=tier
        )
    except ModuleAccessTier.DoesNotExist:
        return

    perms = tier_config.permissions.all()
    RolePermission.objects.bulk_create(
        [RolePermission(role=role, permission=p) for p in perms],
        ignore_conflicts=True,
    )


def apply_template_to_role(role, template) -> None:
    """
    Apply a RoleTemplate's module_tiers to a Role.
    Creates/updates RoleModuleAccess records and syncs permissions.
    """
    for module, tier in template.module_tiers.items():
        rma, _ = RoleModuleAccess.objects.update_or_create(
            role=role,
            module=module,
            defaults={"tier": tier},
        )
        sync_role_module_permissions(rma)


def infer_tier_for_role_module(role, module: str) -> str:
    """
    Look at existing RolePermission rows for role+module and infer
    which AccessTier they most closely approximate.
    Used to populate RoleModuleAccess for existing roles.
    """
    existing_ids = set(
        RolePermission.objects.filter(role=role, permission__module=module)
        .values_list("permission_id", flat=True)
    )
    if not existing_ids:
        return AccessTier.NONE

    best_tier = AccessTier.NONE
    best_overlap = 0.0

    for tier_config in ModuleAccessTier.objects.prefetch_related("permissions").filter(module=module):
        tier_ids = set(tier_config.permissions.values_list("id", flat=True))
        if not tier_ids:
            continue
        overlap = len(existing_ids & tier_ids) / len(tier_ids)
        if overlap > best_overlap:
            best_overlap = overlap
            best_tier = tier_config.tier

    return best_tier
