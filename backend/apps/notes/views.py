from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import Note
from .serializers import NoteSerializer


class NoteViewSet(viewsets.ModelViewSet):
    """Personal sticky notes, scoped by school + author.

    Returns bare arrays (no pagination envelope) — this endpoint predates
    PaginatedModelViewSet's response wrapping and the frontend widgets
    (PageNotesPanel, StickyNoteCard, NoteTrigger, AllNotes, PinnedNotes)
    were all built against a plain JSON array contract.
    """

    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        if not user.school_id:
            return Note.objects.none()

        queryset = Note.objects.filter(school_id=user.school_id, user=user)

        route = self.request.query_params.get('route')
        if route:
            queryset = queryset.filter(route=route)

        pinned = self.request.query_params.get('pinned')
        if pinned and pinned.lower() in {'1', 'true', 'yes'}:
            queryset = queryset.filter(pinned=True)

        archived = self.request.query_params.get('archived')
        if archived and archived.lower() in {'1', 'true', 'yes'}:
            queryset = queryset.filter(archived=True)
        else:
            # Default: hide archived notes (page popover, pinned widget, and
            # AllNotes' default "not archived" view all rely on this).
            queryset = queryset.filter(archived=False)

        limit = self.request.query_params.get('limit')
        if limit and limit.isdigit():
            queryset = queryset[: int(limit)]

        return queryset

    def perform_create(self, serializer):
        serializer.save(school_id=self.request.user.school_id, user=self.request.user)
