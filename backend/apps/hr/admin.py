from django.contrib import admin

from .models import (
    Department,
    DepartmentType,
    Designation,
    LeaveDefine,
    LeaveRequest,
    LeaveType,
    PayrollRecord,
    PayrollSettings,
    Staff,
    StaffAttendance,
    StaffDocument,
)


@admin.register(DepartmentType)
class DepartmentTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "school", "created_at")
    search_fields = ("name",)
    list_filter = ("school",)


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "dept_type", "school", "head", "is_active", "created_at")
    search_fields = ("name", "dept_type")
    list_filter = ("school", "is_active", "dept_type")
    raw_id_fields = ("head", "deputy_head")


@admin.register(Designation)
class DesignationAdmin(admin.ModelAdmin):
    list_display = ("name", "department", "school", "role_template", "employment_type", "is_active")
    search_fields = ("name", "short_code")
    list_filter = ("school", "is_active", "employment_type", "role_template")


@admin.register(Staff)
class StaffAdmin(admin.ModelAdmin):
    list_display = ("first_name", "last_name", "staff_no", "school", "department", "designation", "status", "join_date")
    search_fields = ("first_name", "last_name", "staff_no", "email", "phone")
    list_filter = ("school", "status", "gender", "contract_type", "department")
    raw_id_fields = ("user", "role", "department", "designation")
    readonly_fields = ("created_at", "updated_at")


@admin.register(StaffDocument)
class StaffDocumentAdmin(admin.ModelAdmin):
    list_display = ("staff", "document_type", "file_name", "file_size", "school", "created_at")
    search_fields = ("file_name", "staff__first_name", "staff__last_name")
    list_filter = ("school", "document_type")
    raw_id_fields = ("staff",)


@admin.register(LeaveType)
class LeaveTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "school", "max_days_per_year", "is_paid", "is_active")
    search_fields = ("name",)
    list_filter = ("school", "is_paid", "is_active")


@admin.register(LeaveDefine)
class LeaveDefineAdmin(admin.ModelAdmin):
    list_display = ("leave_type", "school", "role", "staff", "days", "created_at")
    search_fields = ("leave_type__name",)
    list_filter = ("school", "leave_type")
    raw_id_fields = ("role", "staff", "student", "school_class", "section", "leave_type")


@admin.register(StaffAttendance)
class StaffAttendanceAdmin(admin.ModelAdmin):
    list_display = ("staff", "attendance_date", "attendance_type", "school", "created_at")
    search_fields = ("staff__first_name", "staff__last_name", "staff__staff_no")
    list_filter = ("school", "attendance_type", "attendance_date")
    raw_id_fields = ("staff",)
    date_hierarchy = "attendance_date"


@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = ("staff", "leave_type", "from_date", "to_date", "status", "school", "approved_by", "created_at")
    search_fields = ("staff__first_name", "staff__last_name", "reason")
    list_filter = ("school", "status", "leave_type")
    raw_id_fields = ("staff", "leave_type", "approved_by")
    readonly_fields = ("approved_at", "created_at", "updated_at")
    date_hierarchy = "from_date"


@admin.register(PayrollRecord)
class PayrollRecordAdmin(admin.ModelAdmin):
    list_display = ("staff", "payroll_month", "payroll_year", "basic_salary", "allowance", "deduction", "net_salary", "status", "school")
    search_fields = ("staff__first_name", "staff__last_name", "staff__staff_no")
    list_filter = ("school", "status", "payroll_year", "payroll_month")
    raw_id_fields = ("staff", "created_by")
    readonly_fields = ("net_salary", "created_at", "updated_at")


@admin.register(PayrollSettings)
class PayrollSettingsAdmin(admin.ModelAdmin):
    list_display = ("school", "school_name", "default_allowance", "default_deduction", "updated_at")
    search_fields = ("school_name",)
