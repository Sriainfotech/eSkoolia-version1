
from django.db.models import Q
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.models import SmStudent
from apps.reports.serializers import FeesReportSerializer


class FeesReportView(APIView):
    def get(self, request, *args, **kwargs):
        school_id = self.request.user.school_id
        class_id = request.query_params.get('class_id')
        section_id = request.query_params.get('section_id')
        keyword = request.query_params.get('keyword')

        students = SmStudent.objects.filter(school_id=school_id, active_status=1)

        if class_id:
            students = students.filter(class_id=class_id)
        if section_id:
            students = students.filter(section_id=section_id)
        if keyword:
            students = students.filter(
                Q(full_name__icontains=keyword) |
                Q(admission_no__icontains=keyword) |
                Q(roll_no__icontains=keyword) |
                Q(national_id_no__icontains=keyword) |
                Q(local_id_no__icontains=keyword)
            )

        serializer = FeesReportSerializer(students, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
