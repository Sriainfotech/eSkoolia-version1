from rest_framework import serializers

from .models import AssignedIncident, AssignedIncidentComment, BehaviourRecordSetting, Incident


class IncidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Incident
        fields = ["id", "school", "title", "point", "description", "created_at", "updated_at"]
        read_only_fields = ["id", "school", "created_at", "updated_at"]


class AssignedIncidentCommentSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = AssignedIncidentComment
        fields = ["id", "school", "assigned_incident", "user", "user_name", "comment", "created_at"]
        read_only_fields = ["id", "school", "user", "user_name", "created_at"]

    def get_user_name(self, obj):
        if not obj.user_id:
            return ""
        return obj.user.get_full_name().strip() or obj.user.username


class AssignedIncidentSerializer(serializers.ModelSerializer):
    incident_title = serializers.CharField(source="incident.title", read_only=True)
    student_name = serializers.SerializerMethodField(read_only=True)
    class_id = serializers.SerializerMethodField(read_only=True)
    section_id = serializers.SerializerMethodField(read_only=True)
    comments = AssignedIncidentCommentSerializer(many=True, read_only=True)

    class Meta:
        model = AssignedIncident
        fields = [
            "id",
            "school",
            "academic_year",
            "incident",
            "incident_title",
            "student",
            "student_name",
            "record",
            "class_id",
            "section_id",
            "point",
            "assigned_by",
            "comments",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "school",
            "incident_title",
            "student_name",
            "class_id",
            "section_id",
            "assigned_by",
            "comments",
            "created_at",
            "updated_at",
        ]

    def get_student_name(self, obj):
        if not obj.student_id:
            return ""
        return f"{(obj.student.first_name or '').strip()} {(obj.student.last_name or '').strip()}".strip()

    def get_class_id(self, obj):
        if obj.record_id:
            return obj.record.school_class_id
        return obj.student.current_class_id

    def get_section_id(self, obj):
        if obj.record_id:
            return obj.record.section_id
        return obj.student.current_section_id


class AssignedIncidentBulkCreateSerializer(serializers.Serializer):
    academic_year_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    class_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    section_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    student_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), allow_empty=False)
    incident_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), allow_empty=False)


class StudentRankQuerySerializer(serializers.Serializer):
    academic_year_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    class_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    section_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    point = serializers.IntegerField(required=False, allow_null=True)
    operator = serializers.ChoiceField(choices=["above", "below"], required=False, default="above")
    scope = serializers.ChoiceField(choices=["class", "school"], required=False, default="class")
    q = serializers.CharField(required=False, allow_blank=True)


class StudentRankRowSerializer(serializers.Serializer):
    rank = serializers.IntegerField()
    student_id = serializers.IntegerField()
    admission_no = serializers.CharField()
    student_name = serializers.CharField()
    incident_count = serializers.IntegerField()
    total_points = serializers.IntegerField()


class StudentRankSectionSerializer(serializers.Serializer):
    section_id = serializers.IntegerField(allow_null=True)
    section_name = serializers.CharField()
    total_students = serializers.IntegerField()
    total_incidents = serializers.IntegerField()
    total_points = serializers.IntegerField()
    students = StudentRankRowSerializer(many=True)


class StudentRankClassSerializer(serializers.Serializer):
    class_id = serializers.IntegerField(allow_null=True)
    class_name = serializers.CharField()
    total_sections = serializers.IntegerField()
    total_students = serializers.IntegerField()
    total_incidents = serializers.IntegerField()
    total_points = serializers.IntegerField()
    sections = StudentRankSectionSerializer(many=True)


class StudentRankReportMetaSerializer(serializers.Serializer):
    scope = serializers.CharField()
    academic_year_id = serializers.IntegerField(allow_null=True)
    class_id = serializers.IntegerField(allow_null=True)
    section_id = serializers.IntegerField(allow_null=True)
    point = serializers.IntegerField(allow_null=True)
    operator = serializers.CharField()
    q = serializers.CharField(allow_blank=True)


class StudentRankReportSerializer(serializers.Serializer):
    meta = StudentRankReportMetaSerializer()
    classes = StudentRankClassSerializer(many=True)


class BehaviourRecordSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = BehaviourRecordSetting
        fields = [
            "id",
            "school",
            "student_comment",
            "parent_comment",
            "student_view",
            "parent_view",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "school", "created_at", "updated_at"]
