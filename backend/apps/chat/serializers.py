from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db.utils import OperationalError, ProgrammingError
import logging

from .models import (
    Conversation,
    Group,
    GroupUser,
    GroupMessageRecipient,
    Invitation,
    BlockUser,
    UserStatus,
)

User = get_user_model()
logger = logging.getLogger(__name__)


class UserBasicSerializer(serializers.ModelSerializer):
    """Minimal user info for chat context"""
    
    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email"]


class UserDetailedSerializer(serializers.ModelSerializer):
    """Detailed user info with chat status"""
    
    chat_status = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email", "phone", "chat_status"]
    
    def get_chat_status(self, obj):
        try:
            status = obj.chat_status
            return {
                "status": status.get_status_display(),
                "is_online": status.is_online(),
                "last_seen": status.last_seen,
            }
        except (UserStatus.DoesNotExist, OperationalError, ProgrammingError):
            return None
        except Exception as ex:
            logger.warning("UserDetailedSerializer chat_status failed for user_id=%s: %s", getattr(obj, "id", None), ex)
            return None


class ConversationSerializer(serializers.ModelSerializer):
    """Serializer for individual messages in a conversation"""
    
    from_user = UserBasicSerializer(read_only=True)
    to_user = UserBasicSerializer(read_only=True)
    from_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="from_user",
        write_only=True
    )
    to_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="to_user",
        write_only=True
    )
    
    # For nested reply and forward
    reply = serializers.SerializerMethodField()
    forward = serializers.SerializerMethodField()
    
    created_at_human = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            "id",
            "from_user",
            "from_id",
            "to_user",
            "to_id",
            "message",
            "message_type",
            "status",
            "file_name",
            "original_file_name",
            "reply",
            "forward",
            "deleted_by_receiver",
            "is_initial",
            "created_at",
            "updated_at",
            "created_at_human",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "created_at_human",
            "status",
        ]

    def get_reply(self, obj):
        """Get nested reply message if exists"""
        if obj.reply:
            return ConversationSerializer(obj.reply, context=self.context).data
        return None

    def get_forward(self, obj):
        """Get nested forwarded message if exists"""
        if obj.forward:
            return ConversationSerializer(obj.forward, context=self.context).data
        return None

    def get_created_at_human(self, obj):
        """Get human-readable creation time"""
        from django.utils.timesince import timesince
        return f"{timesince(obj.created_at)} ago"

    def validate(self, data):
        """Validate that from_user and to_user are different"""
        from_user = data.get("from_user")
        to_user = data.get("to_user")
        
        if from_user and to_user and from_user == to_user:
            raise serializers.ValidationError(
                "You cannot send a message to yourself."
            )
        
        # Check if users are blocked
        if from_user and to_user:
            if BlockUser.objects.filter(
                blocked_by=to_user,
                blocked_user=from_user
            ).exists():
                raise serializers.ValidationError(
                    "You are blocked by this user."
                )
        
        return data


class ConversationListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for conversation lists"""
    
    from_user = UserBasicSerializer(read_only=True)
    to_user = UserBasicSerializer(read_only=True)
    created_at_human = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            "id",
            "from_user",
            "to_user",
            "message",
            "message_type",
            "status",
            "created_at",
            "created_at_human",
        ]

    def get_created_at_human(self, obj):
        from django.utils.timesince import timesince
        return f"{timesince(obj.created_at)} ago"


class GroupUserSerializer(serializers.ModelSerializer):
    """Serializer for group members"""
    
    user = UserBasicSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="user",
        write_only=True
    )
    added_by_detail = UserBasicSerializer(source="added_by", read_only=True)

    class Meta:
        model = GroupUser
        fields = [
            "id",
            "user",
            "user_id",
            "role",
            "added_by",
            "added_by_detail",
            "created_at",
        ]
        read_only_fields = ["id", "added_by", "created_at"]


class GroupDetailSerializer(serializers.ModelSerializer):
    """Detailed group serializer with members"""
    
    members = GroupUserSerializer(many=True, read_only=True)
    created_by_detail = UserBasicSerializer(source="created_by", read_only=True)

    class Meta:
        model = Group
        fields = [
            "id",
            "name",
            "description",
            "photo_url",
            "privacy",
            "read_only",
            "group_type",
            "created_by",
            "created_by_detail",
            "members",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]


class GroupListSerializer(serializers.ModelSerializer):
    """Lightweight group serializer for lists"""
    
    member_count = serializers.SerializerMethodField()
    created_by_detail = UserBasicSerializer(source="created_by", read_only=True)

    class Meta:
        model = Group
        fields = [
            "id",
            "name",
            "photo_url",
            "group_type",
            "created_by",
            "created_by_detail",
            "member_count",
            "created_at",
        ]

    def get_member_count(self, obj):
        return obj.members.filter(deleted_at__isnull=True).count()


class GroupMessageRecipientSerializer(serializers.ModelSerializer):
    """Serializer for group message delivery status"""
    
    user = UserBasicSerializer(read_only=True)
    conversation = ConversationSerializer(read_only=True)

    class Meta:
        model = GroupMessageRecipient
        fields = [
            "id",
            "user",
            "conversation",
            "group",
            "read_at",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class InvitationSerializer(serializers.ModelSerializer):
    """Serializer for connection invitations"""
    
    from_user = UserDetailedSerializer(read_only=True)
    to_user = UserDetailedSerializer(read_only=True)
    from_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="from_user",
        write_only=True
    )
    to_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="to_user",
        write_only=True
    )

    class Meta:
        model = Invitation
        fields = [
            "id",
            "from_user",
            "from_id",
            "to_user",
            "to_id",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, data):
        """Validate invitation"""
        from_user = data.get("from_user")
        to_user = data.get("to_user")
        
        if from_user and to_user:
            if from_user == to_user:
                raise serializers.ValidationError(
                    "You cannot send an invitation to yourself."
                )
            
            # Check if invitation already exists
            if Invitation.objects.filter(
                from_user=from_user,
                to_user=to_user
            ).exists():
                raise serializers.ValidationError(
                    "Invitation already sent to this user."
                )
        
        return data


class BlockUserSerializer(serializers.ModelSerializer):
    """Serializer for blocked users"""
    
    blocked_by = UserBasicSerializer(read_only=True)
    blocked_user = UserBasicSerializer(read_only=True)
    blocked_user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source="blocked_user",
        write_only=True
    )

    class Meta:
        model = BlockUser
        fields = [
            "id",
            "blocked_by",
            "blocked_user",
            "blocked_user_id",
            "created_at",
        ]
        read_only_fields = ["id", "blocked_by", "created_at"]


class UserStatusSerializer(serializers.ModelSerializer):
    """Serializer for user status"""
    
    class Meta:
        model = UserStatus
        fields = [
            "user",
            "status",
            "last_seen",
        ]
        read_only_fields = ["last_seen"]
