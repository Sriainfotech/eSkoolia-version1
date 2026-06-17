from django.contrib import admin
from .models import (
    AdmissionInquiry,
    AdminSetupEntry,
    CertificateTemplate,
    ComplaintEntry,
    ComplaintType,
    ComplaintSource,
    IdCardTemplate,
    PhoneCallLogEntry,
    PostalDispatchEntry,
    PostalReceiveEntry,
    VisitorBookEntry,
)


@admin.register(AdmissionInquiry)
class AdmissionInquiryAdmin(admin.ModelAdmin):
    list_display = ("id", "full_name", "phone", "class_name", "status", "school", "created_at")
    search_fields = ("full_name", "phone", "email", "class_name")
    list_filter = ("status", "school")


@admin.register(VisitorBookEntry)
class VisitorBookEntryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "purpose", "phone", "no_of_person", "date", "school", "created_at")
    search_fields = ("name", "purpose", "phone", "visitor_id")
    list_filter = ("school", "date")


@admin.register(ComplaintType)
class ComplaintTypeAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "school", "is_active", "created_at")
    search_fields = ("name",)
    list_filter = ("school", "is_active")
    ordering = ("school", "name")


@admin.register(ComplaintSource)
class ComplaintSourceAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "school", "is_active", "created_at")
    search_fields = ("name",)
    list_filter = ("school", "is_active")
    ordering = ("school", "name")


@admin.register(ComplaintEntry)
class ComplaintEntryAdmin(admin.ModelAdmin):
    list_display = ("id", "complaint_by", "complaint_type", "complaint_source", "phone", "date", "school")
    search_fields = ("complaint_by", "complaint_type", "complaint_source", "phone")
    list_filter = ("school", "date", "complaint_type", "complaint_source")


@admin.register(PostalReceiveEntry)
class PostalReceiveEntryAdmin(admin.ModelAdmin):
    list_display = ("id", "from_title", "reference_no", "to_title", "date", "school")
    search_fields = ("from_title", "reference_no", "address", "to_title")
    list_filter = ("school", "date")


@admin.register(PostalDispatchEntry)
class PostalDispatchEntryAdmin(admin.ModelAdmin):
    list_display = ("id", "from_title", "reference_no", "to_title", "date", "school")
    search_fields = ("from_title", "reference_no", "address", "to_title")
    list_filter = ("school", "date")


@admin.register(PhoneCallLogEntry)
class PhoneCallLogEntryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "phone", "date", "next_follow_up_date", "call_type", "school")
    search_fields = ("name", "phone", "call_duration", "description")
    list_filter = ("school", "date", "call_type")


@admin.register(AdminSetupEntry)
class AdminSetupEntryAdmin(admin.ModelAdmin):
    list_display = ("id", "type", "name", "school", "created_at")
    search_fields = ("name", "description")
    list_filter = ("school", "type")


@admin.register(IdCardTemplate)
class IdCardTemplateAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "page_layout_style", "school", "created_at")
    search_fields = ("title",)
    list_filter = ("school", "page_layout_style")


@admin.register(CertificateTemplate)
class CertificateTemplateAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "type", "applicable_role_id", "school", "created_at")
    search_fields = ("title", "body")
    list_filter = ("school", "type")
