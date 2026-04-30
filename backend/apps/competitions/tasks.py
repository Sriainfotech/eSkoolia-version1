"""Celery tasks for batch AI generation and PDF export."""
from __future__ import annotations

import logging
from io import BytesIO

from celery import shared_task
from django.utils import timezone

from .ai import ReviewItem, get_or_generate_review

logger = logging.getLogger(__name__)


@shared_task(name="competitions.batch_generate_reviews")
def batch_generate_reviews(result_ids: list[int], user_id: int | None = None) -> dict:
    from django.contrib.auth import get_user_model
    from .models import Result

    User = get_user_model()
    user = User.objects.filter(pk=user_id).first() if user_id else None
    qs = Result.objects.filter(pk__in=result_ids).select_related("competition", "student")

    processed = 0
    for r in qs:
        student = r.student
        item = ReviewItem(
            student_id=student.id if student else None,
            student_name=getattr(student, "full_name", "") or "",
            student_age=None,
            student_class="",
            competition_id=r.competition_id,
            competition_name=r.competition.name,
            competition_type=r.competition.comp_type,
            competition_level=r.competition.level,
            position=r.position,
            points=r.points,
            personal_contribution=r.personal_contribution,
            performance_notes=r.performance_notes,
        )
        data = get_or_generate_review(item, user=user)
        r.ai_generated = True
        r.ai_prompt_hash = data["prompt_hash"]
        r.ai_response = data["review"]
        r.ai_timestamp = timezone.now()
        r.save(update_fields=["ai_generated", "ai_prompt_hash", "ai_response", "ai_timestamp", "updated_at"])
        processed += 1

    return {"processed": processed}


@shared_task(name="competitions.export_pdf")
def export_competition_pdf(competition_id: int) -> str:
    """Render a simple PDF of competition results. Returns file path."""
    from django.conf import settings
    from .models import Competition

    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import (
            Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
        )
    except ImportError:
        logger.error("reportlab not installed; cannot export PDF")
        return ""

    comp = Competition.objects.prefetch_related("results__student").get(pk=competition_id)
    out_dir = getattr(settings, "MEDIA_ROOT", "/tmp")
    out_path = f"{out_dir}/competition_{competition_id}_{timezone.now():%Y%m%d_%H%M%S}.pdf"

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4)
    styles = getSampleStyleSheet()
    story = [
        Paragraph(f"<b>{comp.name}</b>", styles["Title"]),
        Paragraph(
            f"{comp.date} · {comp.get_level_display()} · {comp.get_comp_type_display()}",
            styles["Normal"],
        ),
        Spacer(1, 12),
    ]
    rows = [["Student", "Position", "Points", "AI Review"]]
    for r in comp.results.all():
        rows.append([
            getattr(r.student, "full_name", "—") if r.student else "—",
            r.get_position_display(),
            str(r.points),
            (r.ai_response or "")[:200],
        ])
    table = Table(rows, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4729F4")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
    ]))
    story.append(table)
    doc.build(story)

    with open(out_path, "wb") as f:
        f.write(buf.getvalue())
    return out_path
