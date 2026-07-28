from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import CallQueueEntry
from .serializers import CallQueueEntrySerializer


class CallQueueEntryViewSet(viewsets.ModelViewSet):
    """Personal call-back queue entries, scoped by school + author.

    Returns bare arrays (no pagination envelope) — the frontend widget
    (CallsQueue) was built against a plain JSON array contract, matching
    the sibling `notes` app's endpoint.
    """

    serializer_class = CallQueueEntrySerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        if not user.school_id:
            return CallQueueEntry.objects.none()
        return CallQueueEntry.objects.filter(school_id=user.school_id, user=user)

    def perform_create(self, serializer):
        serializer.save(school_id=self.request.user.school_id, user=self.request.user)
