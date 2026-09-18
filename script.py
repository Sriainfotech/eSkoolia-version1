import re

with open('backend/apps/teacher_portal/views.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace TeacherExamStudentsView
students_view_old = '''    def get(self, request):
        from apps.exams.models import ExamMarkRegister, ExamMarkRegisterPart, ExamSetup
        from apps.students.models import Student

        user = request.user

        try:
            exam_type_id = int(request.query_params['exam_type_id'])
            class_id     = int(request.query_params['class_id'])
            section_id   = int(request.query_params['section_id'])
            subject_id   = int(request.query_params['subject_id'])
        except (KeyError, ValueError, TypeError):
            return Response(
                {'detail': 'exam_type_id, class_id, section_id and subject_id are required.'},
                status=400,
            )'''

students_view_new = '''    def post(self, request):
        from apps.exams.models import ExamMarkRegister, ExamMarkRegisterPart, ExamSetup, Exam
        from apps.students.models import Student
        from apps.academics.models import SchoolClass, Section, Subject

        user = request.user
        data = request.data

        try:
            exam_id      = int(data['exam_id'])
            class_id     = int(data['class_id'])
            section_id   = int(data['section_id']) if data.get('section_id') else 0
            subject_id   = int(data['subject_id'])
        except (KeyError, ValueError, TypeError):
            return Response(
                {'detail': 'exam_id, class_id, section_id and subject_id are required.'},
                status=400,
            )
            
        exam = Exam.objects.get(id=exam_id)
        exam_type_id = exam.exam_type_id'''

code = code.replace(students_view_old, students_view_new)

# Replace the return of TeacherExamStudentsView
return_old = '''        return Response({
            'components': components,
            'students': student_rows,
            'is_locked': is_any_locked,
        })'''

return_new = '''        search_info = {
            'exam_name': exam.name,
            'class_name': SchoolClass.objects.get(id=class_id).name if SchoolClass.objects.filter(id=class_id).exists() else '',
            'section_name': Section.objects.get(id=section_id).name if section_id and Section.objects.filter(id=section_id).exists() else '',
            'subject_name': Subject.objects.get(id=subject_id).name if Subject.objects.filter(id=subject_id).exists() else '',
        }
        
        # Format student rows to match frontend StudentMarkRow precisely
        formatted_students = []
        for r in student_rows:
            r['student_record_id'] = r['student_id']
            r['student'] = r['student_id']
            r['class'] = class_id
            r['section'] = section_id
            r['marks'] = {str(k): str(v) for k, v in r.get('parts', {}).items()}
            r['first_name'] = r['name'].split()[0] if r['name'] else ''
            r['last_name'] = ' '.join(r['name'].split()[1:]) if r['name'] else ''
            r['total_marks'] = str(r['total_marks'])
            r['total_gpa_point'] = "0"
            r['total_gpa_grade'] = ""
            formatted_students.append(r)

        return Response({
            'exam_id': exam_id,
            'class_id': class_id,
            'section_id': section_id,
            'subject_id': subject_id,
            'search_info': search_info,
            'marks_entry_form': components,
            'students': formatted_students,
            'is_locked': is_any_locked,
        })'''

code = code.replace(return_old, return_new)

# Replace TeacherExamMarksSaveView signature
save_old = '''        try:
            exam_type_id = int(data['exam_type_id'])
            class_id     = int(data['class_id'])
            section_id   = int(data['section_id'])
            subject_id   = int(data['subject_id'])
        except (KeyError, ValueError, TypeError):
            return Response({'detail': 'Missing required fields.'}, status=400)

        rows = data.get('rows', [])
        if not rows:
            return Response({'detail': 'No rows provided.'}, status=400)'''

save_new = '''        try:
            exam_id      = int(data['exam_id'])
            class_id     = int(data['class_id'])
            section_id   = int(data['section_id']) if data.get('section_id') else 0
            subject_id   = int(data['subject_id'])
        except (KeyError, ValueError, TypeError):
            return Response({'detail': 'Missing required fields.'}, status=400)

        exam = Exam.objects.get(id=exam_id)
        exam_type_id = exam.exam_type_id

        rows = data.get('students', [])
        if not rows:
            return Response({'detail': 'No students provided.'}, status=400)'''

code = code.replace(save_old, save_new)

# Replace inside the loop for save
loop_old = '''            for row in rows:
                try:
                    student_id = int(row['student_id'])
                except (KeyError, ValueError, TypeError):
                    continue'''

loop_new = '''            for row in rows:
                try:
                    student_id = int(row['student_record_id'])
                except (KeyError, ValueError, TypeError):
                    continue'''
code = code.replace(loop_old, loop_new)

# Replace TeacherExamMarksLockView
lock_old = '''        try:
            exam_type_id = int(data['exam_type_id'])
            class_id     = int(data['class_id'])
            section_id   = int(data['section_id'])
            subject_id   = int(data['subject_id'])
        except (KeyError, ValueError, TypeError):
            return Response({'detail': 'Missing required fields.'}, status=400)'''

lock_new = '''        from apps.exams.models import Exam
        try:
            exam_id      = int(data['exam_id'])
            class_id     = int(data['class_id'])
            section_id   = int(data['section_id']) if data.get('section_id') else 0
            subject_id   = int(data['subject_id'])
        except (KeyError, ValueError, TypeError):
            return Response({'detail': 'Missing required fields.'}, status=400)
            
        exam = Exam.objects.get(id=exam_id)
        exam_type_id = exam.exam_type_id'''

code = code.replace(lock_old, lock_new)

with open('backend/apps/teacher_portal/views.py', 'w', encoding='utf-8') as f:
    f.write(code)

print("Replacement complete.")
