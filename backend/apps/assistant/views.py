from datetime import date, timedelta

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.db.models import F, Q

from .models import FAQEntry, MessageTemplate, PersonalCalendarEvent
from .serializers import (
    BotQueryLogWriteSerializer,
    FAQEntryListSerializer,
    FAQEntrySerializer,
    MessageTemplateSerializer,
    PersonalCalendarEventSerializer,
)


def _school_override_or_default(model, school_id, topic_key):
    """Tenant override wins; fall back to the global default (school=null)."""
    if school_id:
        override = model.objects.filter(school_id=school_id, topic_key=topic_key, is_active=True).first()
        if override:
            return override
    return model.objects.filter(school_id__isnull=True, topic_key=topic_key, is_active=True).first()


class FAQListView(APIView):
    """GET /api/v1/assistant/faq/ — every active FAQ entry (with keywords)
    for this tenant, merging school overrides over global defaults so the
    frontend can classify a raw query without duplicating the topic list."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        school_id = request.user.school_id
        rows = FAQEntry.objects.filter(
            Q(school_id__isnull=True) | Q(school_id=school_id), is_active=True,
        ).order_by('topic_key', F('school_id').desc(nulls_last=True))  # school-specific row before its global fallback
        merged: dict[str, FAQEntry] = {}
        for row in rows:
            merged.setdefault(row.topic_key, row)
        return Response(FAQEntryListSerializer(list(merged.values()), many=True).data)


class FAQLookupView(APIView):
    """GET /api/v1/assistant/faq/<topic_key>/ — tenant-aware FAQ answer lookup."""

    permission_classes = [IsAuthenticated]

    def get(self, request, topic_key):
        entry = _school_override_or_default(FAQEntry, request.user.school_id, topic_key)
        if not entry:
            return Response({'success': False, 'error': {'code': 'not_found', 'message': 'No FAQ answer for this topic.'}}, status=status.HTTP_404_NOT_FOUND)
        return Response(FAQEntrySerializer(entry).data)


class MessageTemplateLookupView(APIView):
    """GET /api/v1/assistant/message-templates/<topic_key>/ — tenant-aware draft template lookup."""

    permission_classes = [IsAuthenticated]

    def get(self, request, topic_key):
        entry = _school_override_or_default(MessageTemplate, request.user.school_id, topic_key)
        if not entry:
            entry = _school_override_or_default(MessageTemplate, request.user.school_id, 'generic')
        if not entry:
            return Response({'success': False, 'error': {'code': 'not_found', 'message': 'No message template available.'}}, status=status.HTTP_404_NOT_FOUND)
        return Response(MessageTemplateSerializer(entry).data)


class BotTelemetryCreateView(APIView):
    """POST /api/v1/assistant/telemetry/ — log one bot query for recognition-rate tracking."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not request.user.school_id:
            return Response({'success': True}, status=status.HTTP_202_ACCEPTED)
        serializer = BotQueryLogWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(school_id=request.user.school_id, user=request.user)
        return Response({'success': True}, status=status.HTTP_201_CREATED)


def _resolve_week_start(request) -> date:
    raw = request.query_params.get('weekStart') or request.data.get('weekStart')
    if raw:
        try:
            return date.fromisoformat(raw)
        except ValueError:
            pass
    today = date.today()
    return today - timedelta(days=today.weekday())


class PersonalCalendarEventListCreateView(APIView):
    """GET/POST /api/v1/assistant/calendar-events/ — a staff member's own
    week-planner events (the bot's planner-task intent and
    components/widgets/cockpit/WeekAhead.tsx's planner UI both read/write
    here now, instead of eskoolia_week_events_v2_* localStorage)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.school_id:
            return Response([])
        week_start = _resolve_week_start(request)
        events = PersonalCalendarEvent.objects.filter(
            school_id=request.user.school_id, user=request.user, week_start_date=week_start,
        )
        return Response(PersonalCalendarEventSerializer(events, many=True).data)

    def post(self, request):
        if not request.user.school_id:
            return Response({'success': False, 'error': {'code': 'no_school', 'message': 'No school associated with this account.'}}, status=status.HTTP_400_BAD_REQUEST)
        week_start = _resolve_week_start(request)
        serializer = PersonalCalendarEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(school_id=request.user.school_id, user=request.user, week_start_date=week_start)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PersonalCalendarEventDetailView(APIView):
    """PATCH (toggle done, edit) / DELETE one personal calendar event."""

    permission_classes = [IsAuthenticated]

    def _get_object(self, request, pk):
        return PersonalCalendarEvent.objects.filter(
            pk=pk, school_id=request.user.school_id, user=request.user,
        ).first()

    def patch(self, request, pk):
        event = self._get_object(request, pk)
        if not event:
            return Response({'success': False, 'error': {'code': 'not_found', 'message': 'Event not found.'}}, status=status.HTTP_404_NOT_FOUND)
        serializer = PersonalCalendarEventSerializer(event, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        event = self._get_object(request, pk)
        if not event:
            return Response({'success': False, 'error': {'code': 'not_found', 'message': 'Event not found.'}}, status=status.HTTP_404_NOT_FOUND)
        event.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
