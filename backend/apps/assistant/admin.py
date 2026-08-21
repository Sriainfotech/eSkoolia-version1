from django.contrib import admin

from .models import BotQueryLog, FAQEntry, MessageTemplate, PersonalCalendarEvent


@admin.register(FAQEntry)
class FAQEntryAdmin(admin.ModelAdmin):
    list_display = ['topic_key', 'school', 'is_active', 'updated_at']
    list_filter = ['is_active', 'school']
    search_fields = ['topic_key', 'answer']


@admin.register(MessageTemplate)
class MessageTemplateAdmin(admin.ModelAdmin):
    list_display = ['topic_key', 'school', 'is_active', 'updated_at']
    list_filter = ['is_active', 'school']


@admin.register(BotQueryLog)
class BotQueryLogAdmin(admin.ModelAdmin):
    list_display = ['school', 'user', 'resolver_type', 'resolved_intent_id', 'created_at']
    list_filter = ['resolver_type', 'school']
    search_fields = ['query']
    readonly_fields = [f.name for f in BotQueryLog._meta.fields]


@admin.register(PersonalCalendarEvent)
class PersonalCalendarEventAdmin(admin.ModelAdmin):
    list_display = ['title', 'school', 'user', 'week_start_date', 'day_index', 'time']
    list_filter = ['school']
