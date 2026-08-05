from django.contrib import admin
from django.utils.html import format_html

from .models import (
    Conversation,
    Group,
    GroupUser,
    GroupMessageRecipient,
    Invitation,
    BlockUser,
    UserStatus,
    GroupMessageRemove,
)


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ['id', 'from_user', 'to_user', 'message_preview', 'message_type', 'status', 'created_at']
    list_filter = ['message_type', 'status', 'created_at']
    search_fields = ['message', 'from_user__username', 'to_user__username']
    readonly_fields = ['created_at', 'updated_at', 'deleted_at']
    
    fieldsets = (
        ('Message Content', {
            'fields': ('from_user', 'to_user', 'message', 'message_type')
        }),
        ('File Attachment', {
            'fields': ('file_name', 'original_file_name')
        }),
        ('Threading', {
            'fields': ('reply', 'forward')
        }),
        ('Status', {
            'fields': ('status', 'deleted_by_receiver', 'is_initial')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at', 'deleted_at'),
            'classes': ('collapse',)
        }),
    )
    
    def message_preview(self, obj):
        """Show first 100 chars of message"""
        if obj.message:
            preview = obj.message[:100]
            if len(obj.message) > 100:
                preview += '...'
            return preview
        return f"[{obj.get_message_type_display()} File]"
    
    message_preview.short_description = 'Message'


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'created_by', 'group_type', 'member_count', 'read_only', 'created_at']
    list_filter = ['group_type', 'read_only', 'privacy', 'created_at']
    search_fields = ['name', 'description', 'created_by__username']
    readonly_fields = ['id', 'created_at', 'updated_at']
    
    fieldsets = (
        ('Basic Info', {
            'fields': ('id', 'name', 'description', 'photo_url')
        }),
        ('Settings', {
            'fields': ('privacy', 'group_type', 'read_only', 'created_by')
        }),
        ('Context', {
            'fields': ('school', 'class_obj', 'section', 'subject'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def member_count(self, obj):
        """Show count of active members"""
        count = obj.members.filter(deleted_at__isnull=True).count()
        return count
    
    member_count.short_description = 'Members'


@admin.register(GroupUser)
class GroupUserAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'group', 'role', 'is_active', 'added_by', 'created_at']
    list_filter = ['role', 'created_at', 'deleted_at']
    search_fields = ['user__username', 'group__name', 'added_by__username']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Membership', {
            'fields': ('group', 'user', 'role')
        }),
        ('Management', {
            'fields': ('added_by', 'removed_by', 'deleted_at')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def is_active(self, obj):
        """Show if membership is active"""
        if obj.is_active():
            return format_html('<span style="color: green;">✓ Active</span>')
        return format_html('<span style="color: red;">✗ Removed</span>')
    
    is_active.short_description = 'Status'


@admin.register(GroupMessageRecipient)
class GroupMessageRecipientAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'group', 'is_read', 'created_at']
    list_filter = ['read_at', 'created_at', 'deleted_at']
    search_fields = ['user__username', 'group__name']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Message Delivery', {
            'fields': ('user', 'conversation', 'group')
        }),
        ('Status', {
            'fields': ('read_at', 'deleted_at')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def is_read(self, obj):
        """Show read status"""
        if obj.is_read():
            return format_html('<span style="color: blue;">✓ Read</span>')
        return format_html('<span style="color: orange;">○ Unread</span>')
    
    is_read.short_description = 'Status'


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ['id', 'from_user', 'to_user', 'status_display', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['from_user__username', 'to_user__username']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Invitation', {
            'fields': ('from_user', 'to_user', 'status')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def status_display(self, obj):
        """Show status with colors"""
        colors = {
            Invitation.STATUS_PENDING: 'orange',
            Invitation.STATUS_CONNECTED: 'green',
            Invitation.STATUS_BLOCKED: 'red',
        }
        color = colors.get(obj.status, 'gray')
        return format_html(
            f'<span style="color: {color};">● {obj.get_status_display()}</span>'
        )
    
    status_display.short_description = 'Status'


@admin.register(BlockUser)
class BlockUserAdmin(admin.ModelAdmin):
    list_display = ['id', 'blocked_by', 'blocked_user', 'created_at']
    list_filter = ['created_at']
    search_fields = ['blocked_by__username', 'blocked_user__username']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Block Relation', {
            'fields': ('blocked_by', 'blocked_user')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(UserStatus)
class UserStatusAdmin(admin.ModelAdmin):
    list_display = ['user', 'status_display', 'last_seen']
    list_filter = ['status']
    search_fields = ['user__username']
    readonly_fields = ['last_seen']
    
    fieldsets = (
        ('Status', {
            'fields': ('user', 'status')
        }),
        ('Tracking', {
            'fields': ('last_seen',),
            'classes': ('collapse',)
        }),
    )
    
    def status_display(self, obj):
        """Show status with indicator"""
        colors = {
            UserStatus.STATUS_ONLINE: 'green',
            UserStatus.STATUS_OFFLINE: 'gray',
            UserStatus.STATUS_AWAY: 'orange',
        }
        color = colors.get(obj.status, 'gray')
        return format_html(
            f'<span style="color: {color}; font-size: 20px;">● </span> {obj.get_status_display()}'
        )
    
    status_display.short_description = 'Current Status'


@admin.register(GroupMessageRemove)
class GroupMessageRemoveAdmin(admin.ModelAdmin):
    list_display = ['id', 'group_message_recipient', 'user', 'created_at']
    list_filter = ['created_at']
    search_fields = ['group_message_recipient__group__name', 'user__username']
    readonly_fields = ['created_at']
    
    fieldsets = (
        ('Removal Record', {
            'fields': ('group_message_recipient', 'user')
        }),
        ('Timestamps', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )
