import logging

from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.shortcuts import get_object_or_404
from django.db.models import Q, Count, Prefetch
from django.db.utils import OperationalError, ProgrammingError
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.files.storage import default_storage
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

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
from .serializers import (
    ConversationSerializer,
    ConversationListSerializer,
    GroupDetailSerializer,
    GroupListSerializer,
    GroupUserSerializer,
    GroupMessageRecipientSerializer,
    InvitationSerializer,
    BlockUserSerializer,
    UserStatusSerializer,
    UserDetailedSerializer,
)

User = get_user_model()
logger = logging.getLogger(__name__)


def _same_school(user_a, user_b) -> bool:
    """Everyone, including superusers, may only message within their own school."""
    return bool(user_a.school_id) and user_a.school_id == user_b.school_id


def _school_scoped_users(user):
    """Base User queryset for chat features: own school only."""
    return User.objects.filter(school_id=user.school_id)


class ChatPermissionMixin:
    required_permission_code = "utilities.chat.view"
    public_actions = set()
    action_permission_codes = {}

    def check_permissions(self, request):
        action = getattr(self, "action", None)
        
        # For public actions, skip REST framework permission checks
        if action not in self.public_actions:
            super().check_permissions(request)
        
        # If action is public, allow it
        if action in self.public_actions:
            return

        permission_code = self.action_permission_codes.get(action, self.required_permission_code)

        # Only check permission code if user is authenticated
        if not request.user or not request.user.is_authenticated:
            return

        if request.user.is_superuser:
            return

        # Verify user has required permission code
        if not hasattr(request.user, "has_permission_code") or not request.user.has_permission_code(permission_code):
            raise PermissionDenied("You do not have permission to access chat.")


class ChatViewSet(ChatPermissionMixin, viewsets.ModelViewSet):
    """
    ViewSet for one-to-one conversations between users.
    
    Endpoints:
    - GET /chat/ - List conversations
    - POST /chat/ - Create/send a message
    - GET /chat/{id}/ - Get conversation details
    - DELETE /chat/{id}/ - Delete a conversation
    - GET /chat/conversation/{user_id}/ - Get all messages with a user
    - POST /chat/mark-read/ - Mark messages as read
    - POST /chat/forward/ - Forward a message
    - GET /chat/files/{id}/ - Get files shared with a user
    - POST /chat/block-user/ - Block a user
    - POST /chat/unblock-user/ - Unblock a user
    """
    
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ConversationSerializer
    public_actions = set()
    action_permission_codes = {
        "block_user": "utilities.blocked_user.view",
        "unblock_user": "utilities.blocked_user.view",
        "blocked_users": "utilities.blocked_user.view",
    }
    
    def get_queryset(self):
        """Get conversations for the current user"""
        user = self.request.user
        return Conversation.objects.filter(
            Q(from_user=user) | Q(to_user=user)
        ).select_related(
            "from_user", 
            "to_user", 
            "reply",
            "forward"
        ).prefetch_related(
            "group_receipts"
        )

    @action(detail=False, methods=["get"])
    def connected_users(self, request):
        """
        Get all users connected with the current user (via accepted invitations).
        This returns users the current user can chat with.
        """
        current_user = request.user
        
        # Get connected users through accepted invitations
        connected_from = Invitation.objects.filter(
            from_user=current_user,
            status=Invitation.STATUS_CONNECTED
        ).values_list("to_user_id", flat=True)
        
        connected_to = Invitation.objects.filter(
            to_user=current_user,
            status=Invitation.STATUS_CONNECTED
        ).values_list("from_user_id", flat=True)
        
        connected_user_ids = list(connected_from) + list(connected_to)

        users = _school_scoped_users(current_user).filter(
            id__in=connected_user_ids
        ).exclude(
            id=current_user.id
        ).select_related("chat_status").distinct()

        # Fallback: if no explicit invitation connections exist yet,
        # allow listing same-school users for direct chat selection.
        if not users.exists():

            users = _school_scoped_users(current_user).exclude(id=current_user.id).distinct()

        # Exclude users blocked by current user OR who blocked current user.
        blocked_by_me_ids = list(BlockUser.objects.filter(
            blocked_by=current_user
        ).values_list("blocked_user_id", flat=True))
        blocked_me_ids = list(BlockUser.objects.filter(
            blocked_user=current_user
        ).values_list("blocked_by_id", flat=True))
        users = [u for u in users if u.id not in blocked_by_me_ids and u.id not in blocked_me_ids]

        # Check who is blocked
        blocked_ids = set(blocked_by_me_ids)

        serializer = UserDetailedSerializer(users, many=True)
        
        # Annotate blocked status
        users_data = serializer.data
        staff_user_ids = set(
            User.objects.filter(
                Q(is_staff=True)
                | Q(staff_profile__isnull=False)
                | Q(user_roles__role__name__icontains="teacher")
                | Q(user_roles__role__name__icontains="admin")
                | Q(user_roles__role__name__icontains="staff")
                | Q(user_roles__role__name__icontains="driver")
            ).values_list("id", flat=True)
        )

        explicit_student_ids = set(
            User.objects.filter(
                user_roles__role__name__icontains="student"
            ).values_list("id", flat=True)
        )

        for user_data in users_data:
            user_data["blocked"] = user_data["id"] in blocked_ids
            if user_data["id"] in explicit_student_ids:
                user_data["user_type"] = "student"
            elif user_data["id"] in staff_user_ids:
                user_data["user_type"] = "staff"
            else:
                user_data["user_type"] = "student"
        
        return Response({
            "users": users_data
        })

    @action(detail=False, methods=["get"])
    def search_users(self, request):
        """
        Search for users to start a conversation or add to group.
        Query param: query (optional)
        Returns same-school users when query is empty, else matching users.
        """
        query = (request.query_params.get("query") or request.query_params.get("q") or "").strip()
        user_type = request.query_params.get("user_type", "all").strip().lower()
        class_id = request.query_params.get("class_id")

        users = _school_scoped_users(request.user)

        strict_staff_filter = (
            Q(is_staff=True)
            | Q(staff_profile__isnull=False)
            | Q(user_roles__role__name__icontains="teacher")
            | Q(user_roles__role__name__icontains="admin")
            | Q(user_roles__role__name__icontains="staff")
            | Q(user_roles__role__name__icontains="driver")
        )

        explicit_student_users = User.objects.filter(
            user_roles__role__name__icontains="student"
        ).distinct()

        # Filter by user category for modal tabs.
        if user_type == "students":
            if explicit_student_users.exists():
                users = users.filter(id__in=explicit_student_users.values("id"))
            else:
                # Fallback: treat non-staff accounts as students when Student role is not mapped.
                users = users.exclude(strict_staff_filter)
        elif user_type == "staff":
            strict_staff_users = users.filter(strict_staff_filter).distinct()
            if strict_staff_users.exists():
                users = strict_staff_users
            else:
                # Fallback: if no strict staff mapping is available, treat non-student users as staff.
                users = users.exclude(id__in=explicit_student_users.values("id"))

        # Optional class-wise filter for students tab.
        if user_type == "students" and class_id:
            try:
                class_id_int = int(class_id)
                from apps.students.models import Student

                class_students = Student.objects.filter(
                    Q(current_class_id=class_id_int)
                    | Q(multi_class_records__school_class_id=class_id_int)
                ).values("first_name", "last_name", "admission_no")

                student_filter = Q()
                admission_nos = []
                for student in class_students:
                    first_name = (student.get("first_name") or "").strip()
                    last_name = (student.get("last_name") or "").strip()
                    admission_no = (student.get("admission_no") or "").strip()

                    if admission_no:
                        admission_nos.append(admission_no)

                    if first_name and last_name:
                        student_filter |= Q(first_name__iexact=first_name, last_name__iexact=last_name)
                    elif first_name:
                        student_filter |= Q(first_name__iexact=first_name)

                if admission_nos:
                    student_filter |= Q(username__in=admission_nos)

                users = users.filter(student_filter) if student_filter else users.none()
            except (ValueError, TypeError):
                users = users.none()

        if query:
            # Search for users by first_name, last_name, email, or username
            users = users.filter(
                Q(first_name__icontains=query) |
                Q(last_name__icontains=query) |
                Q(email__icontains=query) |
                Q(username__icontains=query)
            )
        else:
            # Show initial user list when opening the modal
            users = users.order_by("first_name", "last_name")

        users = users.distinct()

        # If user is authenticated, exclude themselves and check blocked status
        blocked_ids = []
        if request.user and request.user.is_authenticated:
            users = users.exclude(id=request.user.id)
            try:
                blocked_ids = BlockUser.objects.filter(
                    blocked_by=request.user
                ).values_list("blocked_user_id", flat=True)
                blocked_ids = set(blocked_ids)

                blocked_me_ids = set(
                    BlockUser.objects.filter(
                        blocked_user=request.user
                    ).values_list("blocked_by_id", flat=True)
                )

                users = users.exclude(id__in=blocked_ids).exclude(id__in=blocked_me_ids)
            except (OperationalError, ProgrammingError, Exception) as ex:
                logger.warning("search_users blocked_ids lookup failed; continuing without blocked filter: %s", ex)
                blocked_ids = []

            users = users[:50]  # Limit to 50 results after all filters
        
        serializer = UserDetailedSerializer(users, many=True)
        
        # Annotate blocked status
        users_data = serializer.data
        returned_user_ids = [u.get("id") for u in users_data if u.get("id")]
        staff_user_ids = set(
            User.objects.filter(
                id__in=returned_user_ids
            ).filter(
                strict_staff_filter
            ).values_list("id", flat=True)
        )
        explicit_student_ids = set(
            explicit_student_users.filter(id__in=returned_user_ids).values_list("id", flat=True)
        )

        # Fallback student mapping for only the returned users, so classification stays stable.
        try:
            from apps.students.models import Student

            student_qs = Student.objects.filter(school_id=request.user.school_id)
            student_rows = student_qs.values("first_name", "last_name", "admission_no")
            admission_nos = []
            name_filter = Q()

            for student in student_rows:
                first_name = (student.get("first_name") or "").strip()
                last_name = (student.get("last_name") or "").strip()
                admission_no = (student.get("admission_no") or "").strip()

                if admission_no:
                    admission_nos.append(admission_no)

                if first_name and last_name:
                    name_filter |= Q(first_name__iexact=first_name, last_name__iexact=last_name)
                elif first_name:
                    name_filter |= Q(first_name__iexact=first_name)

            fallback_students_qs = User.objects.filter(id__in=returned_user_ids)
            if admission_nos:
                fallback_students_qs = fallback_students_qs.filter(Q(username__in=admission_nos) | name_filter)
            elif name_filter:
                fallback_students_qs = fallback_students_qs.filter(name_filter)
            else:
                fallback_students_qs = User.objects.none()

            explicit_student_ids.update(fallback_students_qs.values_list("id", flat=True))
        except Exception as ex:
            logger.debug("Fallback student classification skipped in search_users: %s", ex)

        for user_data in users_data:
            user_data["blocked"] = user_data["id"] in blocked_ids
            if user_data["id"] in explicit_student_ids:
                user_data["user_type"] = "student"
            elif user_data["id"] in staff_user_ids:
                user_data["user_type"] = "staff"
            else:
                user_data["user_type"] = "student"
        
        return Response({
            "users": users_data
        })

    @action(detail=False, methods=["get"])
    def conversation(self, request):
        """
        Get all conversations with a specific user.
        Query params: user_id (required)
        """
        user_id = request.query_params.get("user_id")
        if not user_id:
            return Response(
                {"error": "user_id query parameter is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        current_user = request.user
        target_user = get_object_or_404(User, id=user_id)

        if not _same_school(current_user, target_user):
            raise PermissionDenied("You cannot message a user from a different school.")

        # Check if blocked
        if BlockUser.objects.filter(
            blocked_by=target_user,
            blocked_user=current_user
        ).exists():
            return Response(
                {"error": "You are blocked by this user"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get conversations between these two users
        conversations = Conversation.objects.filter(
            Q(from_user=current_user, to_user=target_user) |
            Q(from_user=target_user, to_user=current_user)
        ).select_related(
            "from_user", 
            "to_user",
            "reply",
            "forward"
        ).order_by("created_at")
        
        # Mark all messages as read
        Conversation.objects.filter(
            to_user=current_user,
            from_user=target_user,
            status=Conversation.STATUS_UNREAD
        ).update(status=Conversation.STATUS_READ)
        
        serializer = ConversationSerializer(conversations, many=True)
        return Response({"messages": serializer.data})

    def create(self, request, *args, **kwargs):
        """
        Send a message to another user.
        Required fields: to_id, message (or file_attach)
        """
        current_user = request.user
        
        # Check if message or file is provided
        if not request.data.get("message") and not request.FILES.get("file_attach"):
            return Response(
                {"error": "Message or file attachment is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get target user
        to_id = request.data.get("to_id")
        if not to_id:
            return Response(
                {"error": "to_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        target_user = get_object_or_404(User, id=to_id)

        if not _same_school(current_user, target_user):
            raise PermissionDenied("You cannot message a user from a different school.")

        # Check if blocked in either direction
        if BlockUser.objects.filter(
            blocked_by=target_user,
            blocked_user=current_user
        ).exists():
            return Response(
                {"error": "You are blocked by this user"},
                status=status.HTTP_403_FORBIDDEN
            )

        if BlockUser.objects.filter(
            blocked_by=current_user,
            blocked_user=target_user
        ).exists():
            return Response(
                {"error": "You have blocked this user. Unblock to send messages."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Handle file upload
        file_name = None
        original_file_name = None
        message_type = Conversation.MESSAGE_TYPE_TEXT
        
        if request.FILES.get("file_attach"):
            file_obj = request.FILES.get("file_attach")
            try:
                file_name = default_storage.save(
                    f"chat_files/{file_obj.name}",
                    file_obj
                )
                original_file_name = file_obj.name
                
                # Determine message type based on file extension
                ext = file_obj.name.split(".")[-1].lower()
                if ext in ["jpg", "jpeg", "png", "gif", "webp"]:
                    message_type = Conversation.MESSAGE_TYPE_IMAGE
                elif ext == "pdf":
                    message_type = Conversation.MESSAGE_TYPE_PDF
                elif ext in ["doc", "docx"]:
                    message_type = Conversation.MESSAGE_TYPE_DOC
                elif ext in ["mp3", "wav", "m4a", "webm", "ogg", "oga", "aac", "mp4"]:
                    message_type = Conversation.MESSAGE_TYPE_VOICE
            except Exception as e:
                return Response(
                    {"error": f"File upload failed: {str(e)}"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Create conversation
        conversation = Conversation.objects.create(
            from_user=current_user,
            to_user=target_user,
            message=request.data.get("message") or None,
            file_name=file_name,
            original_file_name=original_file_name,
            message_type=message_type,
            reply_id=request.data.get("reply"),
            forward_id=request.data.get("forward"),
            status=Conversation.STATUS_UNREAD,
        )
        
        serializer = ConversationSerializer(conversation)

        # Push real-time event to both sender and receiver channels.
        channel_layer = get_channel_layer()
        if channel_layer is not None:
            payload = serializer.data
            for user_id in [current_user.id, target_user.id]:
                async_to_sync(channel_layer.group_send)(
                    f"user_{user_id}",
                    {"type": "chat_message", "message": payload},
                )

        return Response(
            {"status": "success", "message": serializer.data},
            status=status.HTTP_201_CREATED
        )

    def destroy(self, request, pk=None):
        """
        Delete a message (soft delete for sender/receiver).
        """
        conversation = self.get_object()
        
        # Check permission
        if conversation.from_user != request.user and conversation.to_user != request.user:
            raise PermissionDenied("You cannot delete this message")
        
        # Mark as deleted
        if conversation.from_user == request.user:
            conversation.delete()
        else:
            conversation.deleted_by_receiver = True
            conversation.save()
        
        return Response(
            {"status": "success"},
            status=status.HTTP_204_NO_CONTENT
        )

    @action(detail=False, methods=["post"])
    def mark_read(self, request):
        """
        Mark one or more conversations as read.
        Required: message_ids (list) or from_user_id
        """
        current_user = request.user
        
        if request.data.get("message_ids"):
            # Mark specific messages as read
            message_ids = request.data.get("message_ids")
            Conversation.objects.filter(
                id__in=message_ids,
                to_user=current_user,
                status=Conversation.STATUS_UNREAD
            ).update(status=Conversation.STATUS_READ)
        
        elif request.data.get("from_user_id"):
            # Mark all messages from a user as read
            from_user_id = request.data.get("from_user_id")
            Conversation.objects.filter(
                from_user_id=from_user_id,
                to_user=current_user,
                status=Conversation.STATUS_UNREAD
            ).update(status=Conversation.STATUS_READ)
        
        return Response({"status": "success"})

    @action(detail=False, methods=["post"])
    def forward(self, request):
        """
        Forward a message to another user.
        Required: from_id, to_id, forward (conversation_id)
        """
        current_user = request.user
        
        if current_user.id != request.data.get("from_id"):
            raise PermissionDenied("You can only forward messages as yourself")
        
        to_id = request.data.get("to_id")
        forward_id = request.data.get("forward")
        
        if not to_id or not forward_id:
            raise ValidationError("to_id and forward conversation_id are required")
        
        target_user = get_object_or_404(User, id=to_id)
        
        # Check if users are connected
        if not self._are_users_connected(current_user, target_user):
            return Response(
                {"error": "Users are not connected"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Create forwarded message
        conversation = Conversation.objects.create(
            from_user=current_user,
            to_user=target_user,
            message=request.data.get("message") or "This is a forwarded message.",
            forward_id=forward_id,
            message_type=Conversation.MESSAGE_TYPE_TEXT,
            status=Conversation.STATUS_UNREAD,
        )
        
        serializer = ConversationSerializer(conversation)
        return Response(
            {"status": "success", "message": serializer.data},
            status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=["get"])
    def files(self, request):
        """
        Get all files shared between current user and another user.
        Query params: user_id (required)
        """
        user_id = request.query_params.get("user_id")
        if not user_id:
            return Response(
                {"error": "user_id query parameter is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        current_user = request.user
        target_user = get_object_or_404(User, id=user_id)
        
        # Get conversations with files
        conversations = Conversation.objects.filter(
            Q(from_user=current_user, to_user=target_user) |
            Q(from_user=target_user, to_user=current_user),
            message_type__gt=Conversation.MESSAGE_TYPE_TEXT  # Exclude text messages
        ).select_related("from_user", "to_user").order_by("-created_at")
        
        serializer = ConversationSerializer(conversations, many=True)
        return Response({"files": serializer.data})

    @action(detail=False, methods=["post"])
    def block_user(self, request):
        """
        Block a user from sending messages.
        Required: user_id
        """
        current_user = request.user
        user_id = request.data.get("user_id")
        
        if not user_id:
            raise ValidationError("user_id is required")
        
        user_to_block = get_object_or_404(User, id=user_id)
        
        if user_to_block == current_user:
            raise ValidationError("You cannot block yourself")
        
        # Create or get block relationship
        BlockUser.objects.get_or_create(
            blocked_by=current_user,
            blocked_user=user_to_block
        )
        
        return Response({"status": "success", "message": "User blocked"})

    @action(detail=False, methods=["post"])
    def unblock_user(self, request):
        """
        Unblock a previously blocked user.
        Required: user_id
        """
        current_user = request.user
        user_id = request.data.get("user_id")
        
        if not user_id:
            raise ValidationError("user_id is required")
        
        BlockUser.objects.filter(
            blocked_by=current_user,
            blocked_user_id=user_id
        ).delete()
        
        return Response({"status": "success", "message": "User unblocked"})

    @action(detail=False, methods=["get"])
    def blocked_users(self, request):
        """Get list of blocked users"""
        current_user = request.user
        
        blocked_users = BlockUser.objects.filter(
            blocked_by=current_user
        ).select_related("blocked_user")
        
        serializer = BlockUserSerializer(blocked_users, many=True)
        return Response({"blocked_users": serializer.data})

    def _are_users_connected(self, user1, user2):
        """Check if two users have an accepted invitation"""
        return Invitation.objects.filter(
            Q(from_user=user1, to_user=user2) |
            Q(from_user=user2, to_user=user1),
            status=Invitation.STATUS_CONNECTED
        ).exists()


class GroupChatViewSet(ChatPermissionMixin, viewsets.ModelViewSet):
    """
    ViewSet for group conversations.
    
    Endpoints:
    - GET /groups/ - List user's groups
    - POST /groups/ - Create a group
    - GET /groups/{id}/ - Get group details and messages
    - DELETE /groups/{id}/ - Delete a group (admin only)
    - POST /groups/{id}/send/ - Send message to group
    - POST /groups/{id}/add-members/ - Add members to group
    - POST /groups/{id}/remove-members/ - Remove members from group
    - POST /groups/{id}/assign-role/ - Assign role to member
    - POST /groups/{id}/leave/ - Leave group
    - POST /groups/{id}/delete-message/ - Delete a message from group
    """
    
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = GroupDetailSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "description"]
    ordering_fields = ["created_at", "name"]

    def get_serializer_class(self):
        if self.action == "list":
            return GroupListSerializer
        return GroupDetailSerializer

    def check_permissions(self, request):
        # Group chat operations require authentication but not permission codes.
        # Any authenticated user can create groups and interact with their own groups.
        viewsets.ModelViewSet.check_permissions(self, request)

    def get_queryset(self):
        """Get groups the current user is a member of"""
        user = self.request.user
        return Group.objects.filter(
            members__user=user,
            members__deleted_at__isnull=True
        ).prefetch_related(
            "members",
            "members__user"
        ).distinct()

    def create(self, request, *args, **kwargs):
        """
        Create a new group.
        Required: name, users (list of user IDs)
        """
        current_user = request.user
        
        name = request.data.get("name")
        user_ids = request.data.get("users", [])
        
        if not name:
            raise ValidationError("Group name is required")
        
        if not user_ids:
            raise ValidationError("At least one user must be added to the group")
        
        # Create group
        group = Group.objects.create(
            name=name,
            description=request.data.get("description", ""),
            photo_url=request.data.get("photo_url"),
            privacy=request.data.get("privacy", Group.PRIVACY_PRIVATE),
            group_type=request.data.get("group_type", Group.GROUP_TYPE_OPEN),
            created_by=current_user,
        )
        
        # Add current user as admin
        GroupUser.objects.create(
            group=group,
            user=current_user,
            role=GroupUser.ROLE_ADMIN,
            added_by=current_user
        )
        
        # Add other users as members (exclude current user and duplicates)
        normalized_ids = []
        for raw_id in user_ids:
            try:
                normalized_ids.append(int(raw_id))
            except (TypeError, ValueError):
                continue

        unique_ids = set(normalized_ids)
        unique_ids.discard(current_user.id)

        for user_id in unique_ids:
            user = get_object_or_404(User, id=user_id)
            GroupUser.objects.create(
                group=group,
                user=user,
                role=GroupUser.ROLE_MEMBER,
                added_by=current_user
            )
        
        # Refresh group with prefetched members for response
        group = Group.objects.prefetch_related(
            "members",
            "members__user"
        ).get(id=group.id)
        
        serializer = GroupDetailSerializer(group)
        return Response(
            {"status": "success", "group": serializer.data},
            status=status.HTTP_201_CREATED
        )

    def retrieve(self, request, pk=None):
        """
        Get group details and last 20 messages.
        """
        group = self.get_object()
        
        # Check if user is member
        if not group.members.filter(
            user=request.user,
            deleted_at__isnull=True
        ).exists():
            raise PermissionDenied("You are not a member of this group")
        
        # Mark all group messages as read
        GroupMessageRecipient.objects.filter(
            user=request.user,
            group=group,
            read_at__isnull=True
        ).update(read_at=timezone.now())
        
        # Get last 20 messages
        messages = GroupMessageRecipient.objects.filter(
            group=group,
            deleted_at__isnull=True
        ).select_related(
            "user",
            "conversation__from_user",
            "conversation__to_user",
            "conversation__reply",
            "conversation__forward"
        ).prefetch_related(
            "removed_messages"
        ).order_by("-created_at")[:20]
        
        serializer = GroupDetailSerializer(group)
        
        return Response({
            "group": serializer.data,
            "messages": GroupMessageRecipientSerializer(messages, many=True).data,
        })

    def destroy(self, request, pk=None):
        """
        Delete a group (only admin can delete).
        """
        group = self.get_object()
        
        # Check if user is admin
        membership = group.members.filter(
            user=request.user,
            deleted_at__isnull=True
        ).first()
        
        if not membership or not membership.is_admin():
            raise PermissionDenied("Only group admin can delete the group")
        
        group.delete()
        
        return Response(
            {"status": "success"},
            status=status.HTTP_204_NO_CONTENT
        )

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        """
        Send a message to the group.
        """
        group = self.get_object()
        current_user = request.user
        
        # Check if user is member
        if not group.members.filter(
            user=current_user,
            deleted_at__isnull=True
        ).exists():
            raise PermissionDenied("You are not a member of this group")
        
        # Check group type restrictions
        membership = group.members.get(user=current_user)
        if group.group_type == Group.GROUP_TYPE_CLOSED and not membership.is_admin():
            raise PermissionDenied("Only admin can send messages in this group")
        
        if not request.data.get("message") and not request.FILES.get("file_attach"):
            return Response(
                {"error": "Message or file attachment is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Handle file upload
        file_name = None
        original_file_name = None
        message_type = Conversation.MESSAGE_TYPE_TEXT
        
        if request.FILES.get("file_attach"):
            file_obj = request.FILES.get("file_attach")
            try:
                file_name = default_storage.save(
                    f"chat_files/{file_obj.name}",
                    file_obj
                )
                original_file_name = file_obj.name
                
                # Determine message type
                ext = file_obj.name.split(".")[-1].lower()
                if ext in ["jpg", "jpeg", "png", "gif", "webp"]:
                    message_type = Conversation.MESSAGE_TYPE_IMAGE
                elif ext == "pdf":
                    message_type = Conversation.MESSAGE_TYPE_PDF
                elif ext in ["doc", "docx"]:
                    message_type = Conversation.MESSAGE_TYPE_DOC
                elif ext in ["mp3", "wav", "m4a"]:
                    message_type = Conversation.MESSAGE_TYPE_VOICE
            except Exception as e:
                return Response(
                    {"error": f"File upload failed: {str(e)}"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Create conversation
        conversation = Conversation.objects.create(
            from_user=current_user,
            to_user=current_user,  # Group messages have same from/to
            message=request.data.get("message") or None,
            file_name=file_name,
            original_file_name=original_file_name,
            message_type=message_type,
            reply_id=request.data.get("reply"),
            forward_id=request.data.get("forward"),
        )
        
        # Create message receipts for all group members
        for member in group.members.filter(deleted_at__isnull=True):
            GroupMessageRecipient.objects.create(
                user=member.user,
                conversation=conversation,
                group=group,
                read_at=timezone.now() if member.user == current_user else None
            )
        
        serializer = ConversationSerializer(conversation)
        return Response(
            {"status": "success", "message": serializer.data},
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=["post"])
    def add_members(self, request, pk=None):
        """
        Add members to group (admin only).
        Required: user_ids (list)
        """
        group = self.get_object()
        current_user = request.user
        
        # Check if user is admin
        membership = group.members.filter(
            user=current_user,
            deleted_at__isnull=True
        ).first()
        
        if not membership or not membership.is_admin():
            raise PermissionDenied("Only admin can add members")
        
        user_ids = request.data.get("user_ids", [])
        if not user_ids:
            raise ValidationError("user_ids is required")
        
        added_count = 0
        for user_id in user_ids:
            user = get_object_or_404(User, id=user_id)
            
            # Check if already member
            if group.members.filter(user=user, deleted_at__isnull=True).exists():
                continue
            
            # Add as member
            GroupUser.objects.create(
                group=group,
                user=user,
                role=GroupUser.ROLE_MEMBER,
                added_by=current_user
            )
            added_count += 1
        
        return Response({
            "status": "success",
            "message": f"{added_count} member(s) added"
        })

    @action(detail=True, methods=["post"])
    def remove_members(self, request, pk=None):
        """
        Remove members from group (admin only).
        Required: user_ids (list)
        """
        group = self.get_object()
        current_user = request.user
        
        # Check if user is admin
        membership = group.members.filter(
            user=current_user,
            deleted_at__isnull=True
        ).first()
        
        if not membership or not membership.is_admin():
            raise PermissionDenied("Only admin can remove members")
        
        user_ids = request.data.get("user_ids", [])
        
        GroupUser.objects.filter(
            group=group,
            user_id__in=user_ids
        ).update(
            deleted_at=timezone.now(),
            removed_by=current_user
        )
        
        return Response({
            "status": "success",
            "message": "Members removed"
        })

    @action(detail=True, methods=["post"])
    def assign_role(self, request, pk=None):
        """
        Assign role to group member (admin only).
        Required: user_id, role
        """
        group = self.get_object()
        current_user = request.user
        
        # Check if user is admin
        membership = group.members.filter(
            user=current_user,
            deleted_at__isnull=True
        ).first()
        
        if not membership or not membership.is_admin():
            raise PermissionDenied("Only admin can assign roles")
        
        user_id = request.data.get("user_id")
        role = request.data.get("role")
        
        if not user_id or role is None:
            raise ValidationError("user_id and role are required")
        
        member = get_object_or_404(
            GroupUser,
            group=group,
            user_id=user_id,
            deleted_at__isnull=True
        )
        
        member.role = role
        member.save()
        
        return Response({"status": "success", "message": "Role updated"})

    @action(detail=True, methods=["post"])
    def leave(self, request, pk=None):
        """
        Leave the group.
        """
        group = self.get_object()
        current_user = request.user
        
        membership = group.members.filter(
            user=current_user,
            deleted_at__isnull=True
        ).first()
        
        if not membership:
            raise PermissionDenied("You are not a member of this group")
        
        membership.deleted_at = timezone.now()
        membership.save()
        
        return Response({"status": "success", "message": "You left the group"})

    @action(detail=True, methods=["post"])
    def delete_message(self, request, pk=None):
        """
        Delete a message from group (hide from current user).
        Required: message_id
        """
        group = self.get_object()
        current_user = request.user
        
        message_id = request.data.get("message_id")
        if not message_id:
            raise ValidationError("message_id is required")
        
        receipt = get_object_or_404(
            GroupMessageRecipient,
            group=group,
            id=message_id
        )
        
        GroupMessageRemove.objects.get_or_create(
            group_message_recipient=receipt,
            user=current_user
        )
        
        return Response({"status": "success", "message": "Message deleted"})


class InvitationViewSet(ChatPermissionMixin, viewsets.ModelViewSet):
    """
    ViewSet for managing connection invitations between users.
    
    Endpoints:
    - GET /invitations/ - List pending invitations
    - POST /invitations/ - Send invitation to a user
    - POST /invitations/{id}/accept/ - Accept an invitation
    - POST /invitations/{id}/decline/ - Decline an invitation
    """
    
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = InvitationSerializer
    required_permission_code = "utilities.invitation.view"

    def check_permissions(self, request):
        # Invitations are per-user records; any authenticated user should be able
        # to send/list/accept/decline their own invitations.
        viewsets.ModelViewSet.check_permissions(self, request)

    def get_queryset(self):
        """Get invitations for current user"""
        user = self.request.user
        return Invitation.objects.filter(
            Q(from_user=user) | Q(to_user=user)
        ).select_related("from_user", "to_user")

    def create(self, request, *args, **kwargs):
        """Send invitation to another user"""
        current_user = request.user
        to_user_id = request.data.get("to_user_id") or request.data.get("to_id")
        
        if not to_user_id:
            raise ValidationError("to_user_id is required")
        
        # Scope to the sender's own school — otherwise a user could send (and
        # sustain) a cross-school chat invitation just by guessing a user id.
        to_user = get_object_or_404(User, id=to_user_id, school_id=current_user.school_id)

        if to_user == current_user:
            raise ValidationError("You cannot send invitation to yourself")
        
        # Check if invitation already exists
        existing = Invitation.objects.filter(
            Q(from_user=current_user, to_user=to_user) |
            Q(from_user=to_user, to_user=current_user)
        ).first()
        
        if existing:
            if existing.is_connected():
                raise ValidationError("You are already connected with this user")
            if existing.is_blocked():
                raise ValidationError("This user is blocked")
            return Response(
                {"message": "Invitation already sent"},
                status=status.HTTP_200_OK
            )
        
        # Create invitation
        invitation = Invitation.objects.create(
            from_user=current_user,
            to_user=to_user,
            status=Invitation.STATUS_PENDING
        )
        
        serializer = InvitationSerializer(invitation)
        return Response(
            {"status": "success", "invitation": serializer.data},
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        """Accept a pending invitation"""
        invitation = self.get_object()
        current_user = request.user
        
        # Check if current user is the recipient
        if invitation.to_user != current_user:
            raise PermissionDenied("You can only accept invitations sent to you")
        
        if not invitation.is_pending():
            raise ValidationError("This invitation cannot be accepted")
        
        invitation.status = Invitation.STATUS_CONNECTED
        invitation.save()
        
        # Create reverse invitation if not exists
        Invitation.objects.get_or_create(
            from_user=invitation.to_user,
            to_user=invitation.from_user,
            defaults={"status": Invitation.STATUS_CONNECTED}
        )
        
        return Response({
            "status": "success",
            "message": "Invitation accepted"
        })

    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        """Decline a pending invitation"""
        invitation = self.get_object()
        current_user = request.user
        
        # Check if current user is the recipient
        if invitation.to_user != current_user:
            raise PermissionDenied("You can only decline invitations sent to you")
        
        if not invitation.is_pending():
            raise ValidationError("This invitation cannot be declined")
        
        invitation.delete()
        
        return Response({
            "status": "success",
            "message": "Invitation declined"
        })

    @action(detail=False, methods=["get"])
    def pending(self, request):
        """Get pending invitations"""
        current_user = request.user
        
        pending = Invitation.objects.filter(
            to_user=current_user,
            status=Invitation.STATUS_PENDING
        ).select_related("from_user")
        
        serializer = InvitationSerializer(pending, many=True)
        return Response({"invitations": serializer.data})


class UserStatusViewSet(ChatPermissionMixin, viewsets.ViewSet):
    """ViewSet for managing user online status"""
    
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=["post"])
    def set_online(self, request):
        """Set current user as online"""
        user = request.user
        status_obj, _ = UserStatus.objects.get_or_create(user=user)
        status_obj.mark_online()
        
        return Response({"status": "success", "message": "Marked as online"})

    @action(detail=False, methods=["post"])
    def set_offline(self, request):
        """Set current user as offline"""
        user = request.user
        status_obj, _ = UserStatus.objects.get_or_create(user=user)
        status_obj.mark_offline()
        
        return Response({"status": "success", "message": "Marked as offline"})

    @action(detail=False, methods=["get"])
    def get_status(self, request):
        """Get status of a user. Defaults to the authenticated user when user_id is omitted."""
        user_id = request.query_params.get("user_id") or request.user.id
        user = get_object_or_404(User, id=user_id)
        try:
            status_obj = user.chat_status
            serializer = UserStatusSerializer(status_obj)
            return Response(serializer.data)
        except UserStatus.DoesNotExist:
            return Response({
                "user": user_id,
                "status": "offline",
                "is_online": False,
            })
