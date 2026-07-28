from rest_framework import serializers

from .models import CallQueueEntry


class CallQueueEntrySerializer(serializers.ModelSerializer):
    sourceLink = serializers.CharField(source='source_link', required=False, allow_blank=True)
    isEmergency = serializers.BooleanField(source='is_emergency', required=False)
    # `markDone()` on the frontend PATCHes {called: true} — accept it as a
    # write-only alias for `done` so the frontend doesn't need to change.
    called = serializers.BooleanField(source='done', required=False, write_only=True)

    class Meta:
        model = CallQueueEntry
        fields = [
            'id', 'name', 'role', 'reason', 'phone', 'urgency',
            'sourceLink', 'isEmergency', 'notes', 'done', 'called',
        ]
        read_only_fields = ['id']
