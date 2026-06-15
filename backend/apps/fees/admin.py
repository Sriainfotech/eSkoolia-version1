from django.contrib import admin
from .models import FeesGroup,FeesType
@admin.register(FeesGroup)
class FeesGroupAdmin(admin.ModelAdmin):
    list_display = ['id','name','description']
    search_fields = ['name']
    list_filter = ['name']
    
@admin.register(FeesType)
class FeesTypeAdmin(admin.ModelAdmin):
    list_display = ['id','name','fees_group','amount']
    search_fields = ['name']
    list_filter = ['fees_group']