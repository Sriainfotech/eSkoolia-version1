from rest_framework import serializers

from .models import BotQueryLog, FAQEntry, MessageTemplate, PersonalCalendarEvent


class FAQEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQEntry
        fields = ['topic_key', 'answer']


class FAQEntryListSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQEntry
        fields = ['topic_key', 'keywords', 'answer']


class MessageTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageTemplate
        fields = ['topic_key', 'body']


class BotQueryLogWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = BotQueryLog
        fields = ['query', 'resolver_type', 'resolved_intent_id']

    def validate_query(self, value):
        return value[:4000]


class BotQueryLogReadSerializer(serializers.ModelSerializer):
    school_name = serializers.CharField(source='school.name', read_only=True, default=None)
    username = serializers.CharField(source='user.username', read_only=True, default=None)

    class Meta:
        model = BotQueryLog
        fields = [
            'id', 'school_id', 'school_name', 'user_id', 'username',
            'query', 'resolver_type', 'resolved_intent_id', 'created_at',
        ]


class PersonalCalendarEventSerializer(serializers.ModelSerializer):
    # camelCase aliases, matching the convention TodoItemSerializer already
    # established for this frontend's widgets.
    dayIndex = serializers.IntegerField(source='day_index')
    aiGenerated = serializers.BooleanField(source='ai_generated', required=False)
    weekStartDate = serializers.DateField(source='week_start_date', required=False)

    class Meta:
        model = PersonalCalendarEvent
        fields = ['id', 'weekStartDate', 'dayIndex', 'time', 'title', 'category', 'note', 'done', 'aiGenerated', 'created_at']
        read_only_fields = ['id', 'created_at']
