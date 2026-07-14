"""
Base serializer classes with common validation and helper methods.
Provides standardized serialization patterns across all models.
"""

from rest_framework import serializers
from django.db import models as django_models


class AuditedModelSerializer(serializers.ModelSerializer):
    """
    Base serializer for models with audit fields (created_at, updated_at, created_by, updated_by).
    Handles read-only fields and common validation patterns.
    """
    
    # Common read-only fields
    created_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    updated_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S", required=False)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True, allow_null=True, required=False)
    updated_by_name = serializers.CharField(source='updated_by.get_full_name', read_only=True, allow_null=True, required=False)

    class Meta:
        model = None
        fields = '__all__'
        read_only_fields = [
            'id',
            'created_at',
            'updated_at',
            'created_by',
            'updated_by',
            'created_by_name',
            'updated_by_name',
        ]


class TenantScopedSerializer(AuditedModelSerializer):
    """
    Serializer for tenant-scoped models (those with school_id field).
    Automatically handles school context and filtering.
    """
    
    school_id = serializers.IntegerField(source='school.id', read_only=True)
    school_name = serializers.CharField(source='school.name', read_only=True)

    class Meta:
        model = None
        fields = '__all__'
        read_only_fields = (
            'id',
            'school',
            'school_id',
            'school_name',
            'created_at',
            'updated_at',
            'created_by',
            'updated_by',
            'created_by_name',
            'updated_by_name',
        )

    def validate_school(self, value):
        """Validate that the school belongs to the current user (superusers included)."""
        request = self.context.get('request')
        if request and request.user:
            if request.user.school_id and value.id != request.user.school_id:
                raise serializers.ValidationError("You can only access your own school's data.")
        return value


class LegacyAliasMixin(serializers.ModelSerializer):
    """
    Mixin to expose legacy PHP-style *_id keys while keeping FK-backed models.
    This helps maintain backward compatibility with frontend code.
    """
    
    def get_field_names(self, declared_fields, model_class):
        """
        Override to add legacy *_id field names for foreign keys.
        """
        field_names = super().get_field_names(declared_fields, model_class)
        
        # Add legacy _id suffixed fields for all foreign keys
        for field in model_class._meta.get_fields():
            if isinstance(field, django_models.ForeignKey):
                legacy_name = f"{field.name}_id"
                if legacy_name not in field_names:
                    field_names.append(legacy_name)
        
        return field_names


class BulkOperationSerializer(serializers.Serializer):
    """
    Base serializer for bulk operations (create multiple, update multiple, delete multiple).
    """
    
    ids = serializers.ListField(
        child=serializers.IntegerField(),
        help_text="List of resource IDs to operate on"
    )
    action = serializers.ChoiceField(
        choices=['delete', 'update', 'activate', 'deactivate'],
        help_text="Action to perform"
    )
    data = serializers.JSONField(
        required=False,
        allow_null=True,
        help_text="Data to update (for update action only)"
    )

    def validate_ids(self, value):
        """Validate that IDs list is not empty."""
        if not value:
            raise serializers.ValidationError("At least one ID must be provided.")
        return value

    def validate(self, data):
        """Validate action-specific requirements."""
        if data['action'] == 'update' and not data.get('data'):
            raise serializers.ValidationError("'data' field is required for update action.")
        return data


class DynamicFieldsSerializer(serializers.ModelSerializer):
    """
    Serializer that allows dynamic field selection via query parameters.
    Usage: ?fields=id,name,email
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # Get the fields parameter from request
        request = self.context.get('request')
        if request:
            fields_param = request.query_params.get('fields')
            if fields_param:
                # Convert comma-separated field names to a set
                allowed_fields = set(fields_param.split(','))
                # Keep only allowed fields
                allowed = set(self.fields.keys()) & allowed_fields
                for field_name in set(self.fields.keys()) - allowed:
                    self.fields.pop(field_name)


class NestedReadOnlySerializer(serializers.ModelSerializer):
    """
    Serializer for nested read-only relationships.
    Provides a simple nested representation without depth issues.
    """
    
    class Meta:
        model = None
        fields = ['id', 'name']  # Adjust as needed
        read_only_fields = ['id', 'name']
