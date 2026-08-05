import uuid
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.files.storage import default_storage

User = get_user_model()


class Conversation(models.Model):
    """
    Represents a one-to-one message between two users.
    Supports text messages, file attachments, replies, and forwarded messages.
    """
    
    MESSAGE_TYPE_TEXT = 0
    MESSAGE_TYPE_IMAGE = 1
    MESSAGE_TYPE_PDF = 2
    MESSAGE_TYPE_DOC = 3
    MESSAGE_TYPE_VOICE = 4
    
    MESSAGE_TYPE_CHOICES = [
        (MESSAGE_TYPE_TEXT, "Text"),
        (MESSAGE_TYPE_IMAGE, "Image"),
        (MESSAGE_TYPE_PDF, "PDF"),
        (MESSAGE_TYPE_DOC, "Document"),
        (MESSAGE_TYPE_VOICE, "Voice"),
    ]
    
    STATUS_UNREAD = 0
    STATUS_READ = 1
    
    STATUS_CHOICES = [
        (STATUS_UNREAD, "Unread"),
        (STATUS_READ, "Read"),
    ]

    # Core message fields
    from_user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="sent_conversations"
    )
    to_user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="received_conversations"
    )
    message = models.TextField(null=True, blank=True)
    
    # File attachment fields
    file_name = models.CharField(max_length=500, null=True, blank=True)
    original_file_name = models.CharField(max_length=500, null=True, blank=True)
    
    # Message metadata
    message_type = models.SmallIntegerField(
        choices=MESSAGE_TYPE_CHOICES,
        default=MESSAGE_TYPE_TEXT
    )
    status = models.SmallIntegerField(
        choices=STATUS_CHOICES,
        default=STATUS_UNREAD
    )
    
    # Threading fields
    reply = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="replies"
    )
    forward = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="forwarded_messages"
    )
    
    # Deletion tracking
    deleted_by_receiver = models.BooleanField(default=False)
    is_initial = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "chat_conversations"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["from_user", "to_user"]),
            models.Index(fields=["to_user", "from_user"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"Conversation: {self.from_user} → {self.to_user} ({self.created_at})"

    def is_from_me(self, user):
        """Check if message is sent from the given user"""
        return self.from_user == user

    def is_for_me(self, user):
        """Check if message is received by the given user"""
        return self.to_user == user

    def mark_as_read(self):
        """Mark conversation as read"""
        if self.status == self.STATUS_UNREAD:
            self.status = self.STATUS_READ
            self.save(update_fields=["status"])

    def delete_file(self):
        """Delete associated file if it exists"""
        if self.file_name:
            try:
                if default_storage.exists(self.file_name):
                    default_storage.delete(self.file_name)
            except Exception:
                pass


class Group(models.Model):
    """
    Represents a group conversation with multiple participants.
    """
    
    PRIVACY_PUBLIC = 1
    PRIVACY_PRIVATE = 2
    
    PRIVACY_CHOICES = [
        (PRIVACY_PUBLIC, "Public"),
        (PRIVACY_PRIVATE, "Private"),
    ]
    
    GROUP_TYPE_OPEN = 1  # Anyone can send message
    GROUP_TYPE_CLOSED = 2  # Only admin can send message
    
    GROUP_TYPE_CHOICES = [
        (GROUP_TYPE_OPEN, "Open"),
        (GROUP_TYPE_CLOSED, "Closed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    photo_url = models.CharField(max_length=500, null=True, blank=True)
    
    privacy = models.SmallIntegerField(
        choices=PRIVACY_CHOICES,
        default=PRIVACY_PRIVATE,
        null=True,
        blank=True
    )
    read_only = models.BooleanField(default=False)
    group_type = models.SmallIntegerField(
        choices=GROUP_TYPE_CHOICES,
        default=GROUP_TYPE_OPEN
    )
    
    created_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="created_groups"
    )
    
    # Optional relation to school context (for class/subject groups)
    school = models.ForeignKey(
        "tenancy.School",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chat_groups"
    )
    class_obj = models.ForeignKey(
        "core.Class",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chat_groups"
    )
    section = models.ForeignKey(
        "core.Section",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chat_groups"
    )
    subject = models.ForeignKey(
        "core.Subject",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chat_groups"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "chat_groups"
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class GroupUser(models.Model):
    """
    Represents a user's membership in a group with role information.
    """
    
    ROLE_ADMIN = 1
    ROLE_MODERATOR = 2
    ROLE_MEMBER = 3
    
    ROLE_CHOICES = [
        (ROLE_ADMIN, "Admin"),
        (ROLE_MODERATOR, "Moderator"),
        (ROLE_MEMBER, "Member"),
    ]

    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name="members"
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="group_memberships"
    )
    role = models.SmallIntegerField(
        choices=ROLE_CHOICES,
        default=ROLE_MEMBER
    )
    
    added_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="added_group_members"
    )
    removed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="removed_group_members"
    )
    
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "chat_group_users"
        unique_together = [["group", "user"]]
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.user} in {self.group} (Role: {self.get_role_display()})"

    def is_active(self):
        """Check if membership is currently active (not deleted)"""
        return self.deleted_at is None

    def is_admin(self):
        return self.role == self.ROLE_ADMIN

    def is_moderator(self):
        return self.role == self.ROLE_MODERATOR


class GroupMessageRecipient(models.Model):
    """
    Tracks which users have received/read a message in a group.
    Created for each group member when a message is sent to a group.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="group_message_receipts"
    )
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="group_receipts"
    )
    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name="message_recipients"
    )
    
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "chat_group_message_recipients"
        unique_together = [["user", "conversation", "group"]]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} received message in {self.group}"

    def mark_as_read(self):
        """Mark the message as read by the user"""
        if not self.read_at:
            self.read_at = timezone.now()
            self.save(update_fields=["read_at"])

    def is_read(self):
        return self.read_at is not None


class GroupMessageRemove(models.Model):
    """
    Tracks which users have deleted a message from their view in a group chat.
    """

    group_message_recipient = models.ForeignKey(
        GroupMessageRecipient,
        on_delete=models.CASCADE,
        related_name="removed_messages"
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="removed_group_messages"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "chat_group_message_removes"
        unique_together = [["group_message_recipient", "user"]]

    def __str__(self):
        return f"{self.user} removed message from {self.group_message_recipient.group}"


class Invitation(models.Model):
    """
    Represents a connection invitation between two users.
    Users must be invited and accept before they can communicate.
    """
    
    STATUS_PENDING = 0
    STATUS_CONNECTED = 1
    STATUS_BLOCKED = 2
    
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_CONNECTED, "Connected"),
        (STATUS_BLOCKED, "Blocked"),
    ]

    from_user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="sent_invitations"
    )
    to_user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="received_invitations"
    )
    
    status = models.SmallIntegerField(
        choices=STATUS_CHOICES,
        default=STATUS_PENDING
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "chat_invitations"
        unique_together = [["from_user", "to_user"]]
        ordering = ["-created_at"]

    def __str__(self):
        return f"Invitation: {self.from_user} → {self.to_user} ({self.get_status_display()})"

    def is_pending(self):
        return self.status == self.STATUS_PENDING

    def is_connected(self):
        return self.status == self.STATUS_CONNECTED

    def is_blocked(self):
        return self.status == self.STATUS_BLOCKED


class BlockUser(models.Model):
    """
    Represents a user blocking another user from communication.
    """

    blocked_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="blocked_users"
    )
    blocked_user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="blocked_by_users"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "chat_block_users"
        unique_together = [["blocked_by", "blocked_user"]]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.blocked_by} blocked {self.blocked_user}"


class UserStatus(models.Model):
    """
    Tracks online/offline status of users.
    """
    
    STATUS_ONLINE = 1
    STATUS_OFFLINE = 0
    STATUS_AWAY = 2
    
    STATUS_CHOICES = [
        (STATUS_ONLINE, "Online"),
        (STATUS_OFFLINE, "Offline"),
        (STATUS_AWAY, "Away"),
    ]

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="chat_status"
    )
    status = models.SmallIntegerField(
        choices=STATUS_CHOICES,
        default=STATUS_OFFLINE
    )
    last_seen = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "chat_user_statuses"

    def __str__(self):
        return f"{self.user} - {self.get_status_display()}"

    def is_online(self):
        return self.status == self.STATUS_ONLINE

    def mark_online(self):
        """Mark user as online"""
        self.status = self.STATUS_ONLINE
        self.save(update_fields=["status", "last_seen"])

    def mark_offline(self):
        """Mark user as offline"""
        self.status = self.STATUS_OFFLINE
        self.save(update_fields=["status", "last_seen"])
