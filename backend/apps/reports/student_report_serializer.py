
from rest_framework import serializers
from apps.core.models import StudentRecord

class StudentReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentRecord
        fields = [
            'student',
            'class_name',
            'section_name',
            'roll_no',
            'admission_no',
            'full_name',
            'father_name',
            'mother_name',
            'date_of_birth',
            'gender',
            'mobile',
        ]

    student = serializers.StringRelatedField(source='student.full_name')
    class_name = serializers.StringRelatedField(source='class.class_name')
    section_name = serializers.StringRelatedField(source='section.section_name')
    roll_no = serializers.CharField(source='student.roll_no')
    admission_no = serializers.CharField(source='student.admission_no')
    full_name = serializers.CharField(source='student.full_name')
    father_name = serializers.CharField(source='student.father_name')
    mother_name = serializers.CharField(source='student.mother_name')
    date_of_birth = serializers.DateField(source='student.date_of_birth')
    gender = serializers.CharField(source='student.gender.base_setup_name')
    mobile = serializers.CharField(source='student.mobile')
