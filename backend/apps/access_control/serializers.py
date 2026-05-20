import re

from rest_framework import serializers
from .models import Permission, Role, UserRole


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ["id", "code", "name", "module", "created_at"]
        read_only_fields = ["id", "created_at"]


class RoleMinimalSerializer(serializers.ModelSerializer):
    """Lightweight serializer for role lists — excludes the M2M permission_ids field."""
    class Meta:
        model = Role
        fields = ["id", "name", "is_system", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]


class RoleSerializer(serializers.ModelSerializer):
    permission_ids = serializers.PrimaryKeyRelatedField(
        source="permissions", queryset=Permission.objects.all(), many=True, required=False
    )

    class Meta:
        model = Role
        fields = ["id", "school", "name", "is_system", "is_active", "permission_ids", "created_at", "updated_at"]
        read_only_fields = ["id", "school", "created_at", "updated_at"]

    def validate_name(self, value):
        normalized = (value or "").strip()
        if not normalized:
            raise serializers.ValidationError("Role name is required.")
        if len(normalized) > 30:
            raise serializers.ValidationError(
                "Role name cannot exceed 30 characters."
            )
        if not re.fullmatch(r"[A-Za-z ]+", normalized):
            raise serializers.ValidationError(
                "Role name can only contain letters and spaces. "
                "Numbers and special characters (e.g. @, _, -, 1, 2) are not allowed."
            )
        # Reject names with 3+ consecutive identical letters (e.g. "wwwwww", "Staffff").
        if re.search(r"(.)\1{2,}", normalized, re.IGNORECASE):
            raise serializers.ValidationError(
                "Role name cannot contain the same letter repeated more than twice in a row."
            )

        request = self.context.get("request")
        user = getattr(request, "user", None)
        # Use school_id directly to avoid an extra FK traversal that could mask the value.
        school_id = getattr(user, "school_id", None)

        duplicate_qs = Role.objects.filter(name__iexact=normalized)
        if school_id is not None:
            duplicate_qs = duplicate_qs.filter(school_id=school_id)
        else:
            duplicate_qs = duplicate_qs.filter(school__isnull=True)

        if self.instance:
            duplicate_qs = duplicate_qs.exclude(pk=self.instance.pk)

        if duplicate_qs.exists():
            # Give a more specific hint when the only conflict is a deactivated role.
            if not duplicate_qs.filter(is_active=True).exists():
                raise serializers.ValidationError(
                    "A deactivated role with this name already exists. "
                    "Reactivate it or delete it before creating a new one."
                )
            raise serializers.ValidationError("A role with this name already exists.")

        return normalized

    def create(self, validated_data):
        permissions = validated_data.pop("permissions", [])
        role = Role.objects.create(**validated_data)
        role.permissions.set(permissions)
        return role

    def update(self, instance, validated_data):
        permissions = validated_data.pop("permissions", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        if permissions is not None:
            instance.permissions.set(permissions)
        return instance


class UserRoleSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField(read_only=True)
    role_name = serializers.CharField(source="role.name", read_only=True)

    class Meta:
        model = UserRole
        fields = ["id", "user", "role", "user_name", "role_name", "created_at"]
        read_only_fields = ["id", "created_at"]

    def get_user_name(self, obj):
        user = obj.user
        if not user:
            return None
        full_name = f"{user.first_name} {user.last_name}".strip()
        return full_name or user.username
