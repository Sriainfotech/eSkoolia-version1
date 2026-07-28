from rest_framework import serializers

from .models import Note


class NoteSerializer(serializers.ModelSerializer):
    author_initials = serializers.SerializerMethodField()

    class Meta:
        model = Note
        fields = [
            'id', 'route', 'color', 'text', 'position_x', 'position_y',
            'width', 'height',
            'pinned', 'archived', 'created_at', 'updated_at', 'author_initials',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_author_initials(self, obj):
        first = (obj.user.first_name or '').strip()
        last = (obj.user.last_name or '').strip()
        initials = f'{first[:1]}{last[:1]}'.upper()
        return initials or (obj.user.username or '?')[:2].upper()
