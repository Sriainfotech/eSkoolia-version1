from io import BytesIO
import csv
from datetime import date, datetime
from django.http import HttpResponse
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from .models import Staff, StaffAttendance

class StaffAttendanceDownloadSampleAPIView(APIView):
    def get(self, request):
        try:
            from openpyxl import Workbook
        except Exception:
            return Response({"detail": "openpyxl is required for sample export."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "staff_attendance_sheet"
        headers = [
            "staff_no",
            "attendance_date",
            "attendance_type",
            "note",
            "arrival_time",
            "sign_in_time",
            "sign_out_time",
            "lunch",
        ]
        sheet.append(headers)

        output = BytesIO()
        workbook.save(output)
        output.seek(0)

        response = HttpResponse(
            output.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="staff_attendance_sheet.xlsx"'
        return response

class StaffAttendanceExportAPIView(APIView):
    def get(self, request):
        attendance_date = request.query_params.get("date")
        if not attendance_date:
            return Response({"detail": "date is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        school = request.user.school or getattr(request, "school", None)
        qs = StaffAttendance.objects.filter(attendance_date=attendance_date)
        if school:
            qs = qs.filter(school=school)
            
        format_type = request.query_params.get("format", "csv")
        
        if format_type == "csv":
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="staff_attendance_{attendance_date}.csv"'
            writer = csv.writer(response)
            writer.writerow(["staff_no", "first_name", "last_name", "attendance_date", "attendance_type", "arrival_time", "sign_in_time", "sign_out_time", "lunch", "note"])
            for att in qs.select_related("staff"):
                writer.writerow([
                    att.staff.staff_no,
                    att.staff.first_name,
                    att.staff.last_name,
                    att.attendance_date,
                    att.attendance_type,
                    att.arrival_time,
                    att.sign_in_time,
                    att.sign_out_time,
                    att.lunch,
                    att.note
                ])
            return response
        else:
            return Response({"detail": "Unsupported format"}, status=status.HTTP_400_BAD_REQUEST)

class StaffAttendanceImportBulkAPIView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def _normalize_date(self, value):
        if value is None or value == "":
            return None
        if isinstance(value, date):
            return value
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, (int, float)):
            try:
                from openpyxl.utils.datetime import from_excel
                converted = from_excel(value)
                if isinstance(converted, datetime):
                    return converted.date()
                if isinstance(converted, date):
                    return converted
            except Exception:
                return None
        if isinstance(value, str):
            text = value.strip()
            for fmt in ["%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d"]:
                try:
                    return datetime.strptime(text, fmt).date()
                except ValueError:
                    continue
        return None

    def post(self, request):
        attendance_date = request.data.get("attendance_date")
        uploaded_file = request.FILES.get("file")

        if not attendance_date or not uploaded_file:
            return Response(
                {"detail": "attendance_date and file are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request_date = self._normalize_date(attendance_date)
        if not request_date:
            return Response({"detail": "Invalid attendance_date."}, status=status.HTTP_400_BAD_REQUEST)

        school = request.user.school or getattr(request, "school", None)
        
        imported_rows = []
        ext = uploaded_file.name.split(".")[-1].lower() if "." in uploaded_file.name else ""
        if ext == "csv":
            try:
                content = uploaded_file.read().decode("utf-8", errors="ignore")
                from io import StringIO
                reader = csv.DictReader(StringIO(content))
                for row in reader:
                    imported_rows.append(row)
            except Exception as e:
                return Response({"detail": f"Failed to parse CSV: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
        else:
            try:
                from openpyxl import load_workbook
                workbook = load_workbook(uploaded_file, data_only=True)
                sheet = workbook.active
                rows = list(sheet.iter_rows(values_only=True))
                if rows:
                    headers = [str(h).strip() if h is not None else "" for h in rows[0]]
                    for row in rows[1:]:
                        row_dict = {}
                        for i, h in enumerate(headers):
                            if i < len(row):
                                row_dict[h] = row[i]
                        imported_rows.append(row_dict)
            except Exception as e:
                return Response({"detail": f"Failed to parse Excel file: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        valid_types = ["P", "A", "L", "F", "H"]
        processed = 0
        failed = 0
        errors = []

        for row_num, row in enumerate(imported_rows, start=2):
            staff_no = str(row.get("staff_no") or "").strip()
            if not staff_no:
                errors.append({"row": row_num, "message": "staff_no is required"})
                failed += 1
                continue

            staff = Staff.objects.filter(staff_no=staff_no, school=school).first()
            if not staff:
                errors.append({"row": row_num, "message": f"Staff with staff_no {staff_no} not found"})
                failed += 1
                continue

            att_type = str(row.get("attendance_type") or "").strip()
            if att_type and att_type not in valid_types:
                errors.append({"row": row_num, "message": f"Invalid attendance_type {att_type}"})
                failed += 1
                continue
            
            note = str(row.get("note") or "").strip()
            lunch = str(row.get("lunch") or "").strip().lower() in ["1", "true", "yes", "y", "t"]
            
            try:
                StaffAttendance.objects.update_or_create(
                    school=school,
                    staff=staff,
                    attendance_date=request_date,
                    defaults={
                        "attendance_type": att_type or "P",
                        "note": note,
                        "lunch": lunch
                    }
                )
                processed += 1
            except Exception as e:
                errors.append({"row": row_num, "message": str(e)})
                failed += 1

        return Response({
            "success": failed == 0,
            "message": f"Imported {processed}, failed {failed}",
            "data": {"imported": processed, "failed": failed, "errors": errors[:50]}
        })
