from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import TodoItem
from .serializers import TodoItemSerializer


class TodoItemViewSet(viewsets.ModelViewSet):
    """Personal to-do items, scoped by school + author.

    Returns bare arrays (no pagination envelope) — the frontend widget
    (SmartTodoList) was built against a plain JSON array contract, matching
    the sibling `notes` app's endpoint.
    """

    serializer_class = TodoItemSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        if not user.school_id:
            return TodoItem.objects.none()

        queryset = TodoItem.objects.filter(school_id=user.school_id, user=user)

        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)

        return queryset

    def perform_create(self, serializer):
        serializer.save(school_id=self.request.user.school_id, user=self.request.user)
