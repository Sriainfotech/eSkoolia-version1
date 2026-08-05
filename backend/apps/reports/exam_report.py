
from django.db.models import Sum
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.models import SmOnlineExam, SmStudent, SmStudentTakeOnlineExam
from apps.reports.serializers import ExamReportSerializer


class ExamReportView(APIView):
    def get(self, request, *args, **kwargs):
        school_id = self.request.user.school_id
        exam_id = request.query_params.get('exam_id')
        class_id = request.query_params.get('class_id')
        section_id = request.query_params.get('section_id')

        if not all([exam_id, class_id, section_id]):
            return Response({"error": "exam_id, class_id, and section_id are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            online_exam = SmOnlineExam.objects.get(id=exam_id, school_id=school_id)
        except SmOnlineExam.DoesNotExist:
            return Response({"error": "Exam not found"}, status=status.HTTP_404_NOT_FOUND)

        students = SmStudent.objects.filter(class_id=class_id, section_id=section_id, school_id=school_id)
        
        present_students_ids = SmStudentTakeOnlineExam.objects.filter(online_exam_id=exam_id, student_id__in=students.values_list('id', flat=True)).values_list('student_id', flat=True)

        total_marks = online_exam.assignQuestions.aggregate(total_marks=Sum('questionBank__marks'))['total_marks'] or 0

        data = {
            'online_exam': online_exam,
            'students': students,
            'present_students_ids': list(present_students_ids),
            'total_marks': total_marks
        }

        serializer = ExamReportSerializer(data)
        return Response(serializer.data, status=status.HTTP_200_OK)
