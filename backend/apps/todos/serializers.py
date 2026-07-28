from rest_framework import serializers

from .models import TodoItem


class TodoItemSerializer(serializers.ModelSerializer):
    dueAt = serializers.DateTimeField(source='due_at', required=False, allow_null=True)
    aiGenerated = serializers.BooleanField(source='ai_generated', required=False)
    aiReason = serializers.CharField(source='ai_reason', required=False, allow_blank=True)

    class Meta:
        model = TodoItem
        fields = [
            'id', 'text', 'category', 'priority', 'dueAt',
            'aiGenerated', 'aiReason', 'completed',
        ]
        read_only_fields = ['id']
