from rest_framework import serializers

from .models import AIRequestLog, Club, Competition, House, Result, Team


class HouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = House
        fields = ["id", "name", "color", "motto"]


class ClubSerializer(serializers.ModelSerializer):
    class Meta:
        model = Club
        fields = ["id", "name", "description"]


class TeamSerializer(serializers.ModelSerializer):
    member_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, required=False, source="members", queryset=None,
    )

    class Meta:
        model = Team
        fields = ["id", "competition", "name", "members", "member_ids"]
        read_only_fields = ["members"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from apps.students.models import Student
        self.fields["member_ids"].child_relation.queryset = Student.objects.all()


class CompetitionSerializer(serializers.ModelSerializer):
    teams = TeamSerializer(many=True, read_only=True)

    class Meta:
        model = Competition
        fields = [
            "id", "school", "name", "date", "level", "comp_type",
            "location", "opponent", "notes", "created_by",
            "created_at", "updated_at", "teams",
        ]
        read_only_fields = ["created_by", "created_at", "updated_at"]


class ResultListSerializer(serializers.ListSerializer):
    def create(self, validated_data):
        return [Result.objects.create(**item) for item in validated_data]


class ResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = Result
        list_serializer_class = ResultListSerializer
        fields = [
            "id", "competition", "student", "team", "house", "club",
            "position", "points", "personal_contribution", "performance_notes",
            "ai_generated", "ai_prompt_hash", "ai_response", "ai_timestamp",
            "created_at", "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class AIReviewItemSerializer(serializers.Serializer):
    student_id = serializers.IntegerField(required=False, allow_null=True)
    student_name = serializers.CharField(required=False, allow_blank=True)
    student_age = serializers.IntegerField(required=False, allow_null=True)
    student_class = serializers.CharField(required=False, allow_blank=True)
    competition_id = serializers.IntegerField(required=False, allow_null=True)
    competition_name = serializers.CharField(required=False, allow_blank=True)
    competition_type = serializers.CharField(required=False, allow_blank=True)
    competition_level = serializers.CharField(required=False, allow_blank=True)
    position = serializers.ChoiceField(choices=[c[0] for c in Result.POSITION_CHOICES])
    points = serializers.IntegerField(required=False, default=0)
    personal_contribution = serializers.CharField(required=False, allow_blank=True)
    performance_notes = serializers.CharField(required=False, allow_blank=True)


class AIReviewBatchSerializer(serializers.Serializer):
    items = AIReviewItemSerializer(many=True)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("At least one item is required.")
        if len(value) > 50:
            raise serializers.ValidationError("Maximum 50 items per request.")
        return value


class AIReviewResponseItemSerializer(serializers.Serializer):
    student_id = serializers.IntegerField(allow_null=True)
    competition_id = serializers.IntegerField(allow_null=True)
    position = serializers.CharField()
    review = serializers.CharField()
    prompt_hash = serializers.CharField()
    cache_hit = serializers.BooleanField()
    fallback = serializers.BooleanField()


class AIReviewResponseSerializer(serializers.Serializer):
    results = AIReviewResponseItemSerializer(many=True)


class AIRequestLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIRequestLog
        fields = [
            "id", "user", "prompt_hash", "prompt", "response",
            "cost_estimate", "cache_hit", "error", "created_at",
        ]
        read_only_fields = fields
