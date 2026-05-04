from django.contrib import admin
from .models import Guardian, Student, StudentCategory, StudentClubMembership, StudentDocument, StudentGroup, StudentMultiClassRecord, StudentTransferHistory

admin.site.register(StudentCategory)
admin.site.register(StudentClubMembership)
admin.site.register(StudentGroup)
admin.site.register(Guardian)
admin.site.register(Student)
admin.site.register(StudentDocument)
admin.site.register(StudentTransferHistory)
admin.site.register(StudentMultiClassRecord)
