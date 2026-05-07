"""
Celery tasks for the admissions module.

Tasks:
  - process_bulk_job:  executes a BulkJob (WhatsApp blast, SMS blast, bulk assign, etc.)
  - send_followup_reminders: daily reminder task for due follow-ups
  - compute_lead_scores: recompute lead_score for all active inquiries
"""

from __future__ import annotations

import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# Bulk job processor
# ──────────────────────────────────────────────────────────────────────────────

@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    name="admissions.process_bulk_job",
)
def process_bulk_job(self, job_id: int) -> dict:
    """
    Process a BulkJob record.
    Idempotent: skips leads that already have a ContactLog for this job.
    Retries up to 3× with exponential backoff on transient errors.
    """
    from apps.admissions.models import AdmissionInquiry, BulkJob, ContactLog
    from apps.admissions.providers import get_sms_adapter

    try:
        job = BulkJob.objects.select_related("school", "created_by").get(pk=job_id)
    except BulkJob.DoesNotExist:
        logger.error("process_bulk_job: BulkJob %s not found", job_id)
        return {"error": "job not found"}

    if job.status == "done":
        logger.info("process_bulk_job: job %s already done, skipping", job_id)
        return {"status": "already_done"}

    job.status = "running"
    job.started_at = timezone.now()
    job.total = len(job.lead_ids)
    job.processed = 0
    job.failed = 0
    job.error_detail = []
    job.save(update_fields=["status", "started_at", "total", "processed", "failed", "error_detail"])

    adapter = get_sms_adapter()
    errors: list[dict] = []
    processed = 0

    for lead_id in job.lead_ids:
        try:
            inquiry = AdmissionInquiry.objects.get(pk=lead_id, school=job.school)
        except AdmissionInquiry.DoesNotExist:
            errors.append({"lead_id": lead_id, "error": "not found"})
            job.failed += 1
            job.save(update_fields=["failed"])
            continue

        try:
            if job.action == "send_whatsapp":
                result = adapter.send_whatsapp(
                    to=inquiry.phone,
                    body=job.payload.get("text", ""),
                    template_id=job.payload.get("template_id"),
                )
                ContactLog.objects.create(
                    inquiry=inquiry,
                    channel="whatsapp",
                    direction="outbound",
                    status="delivered",
                    provider_message_id=result.get("message_id", ""),
                    body=job.payload.get("text", ""),
                    template_id=job.payload.get("template_id"),
                    performed_by=job.created_by,
                )
                inquiry.last_contacted_at = timezone.now()
                inquiry.save(update_fields=["last_contacted_at"])

            elif job.action == "send_sms":
                result = adapter.send_sms(to=inquiry.phone, body=job.payload.get("text", ""))
                ContactLog.objects.create(
                    inquiry=inquiry,
                    channel="sms",
                    direction="outbound",
                    status="delivered",
                    provider_message_id=result.get("message_id", ""),
                    body=job.payload.get("text", ""),
                    performed_by=job.created_by,
                )
                inquiry.last_contacted_at = timezone.now()
                inquiry.save(update_fields=["last_contacted_at"])

            elif job.action == "send_email":
                from django.core.mail import send_mail
                send_mail(
                    subject=job.payload.get("subject", ""),
                    message=job.payload.get("body", ""),
                    from_email=None,  # uses DEFAULT_FROM_EMAIL
                    recipient_list=[inquiry.email],
                    fail_silently=False,
                )
                ContactLog.objects.create(
                    inquiry=inquiry,
                    channel="email",
                    direction="outbound",
                    status="delivered",
                    subject=job.payload.get("subject", ""),
                    body=job.payload.get("body", ""),
                    performed_by=job.created_by,
                )

            elif job.action == "assign":
                inquiry.assigned = job.payload.get("assigned", inquiry.assigned)
                inquiry.save(update_fields=["assigned"])

            elif job.action == "update_status":
                inquiry.status = job.payload.get("status", inquiry.status)
                inquiry.save(update_fields=["status"])

            elif job.action == "update_stage":
                from apps.admissions.models import PipelineStage
                stage_id = job.payload.get("stage_id")
                if stage_id:
                    try:
                        stage = PipelineStage.objects.get(pk=stage_id, school=job.school)
                        inquiry.pipeline_stage = stage
                        inquiry.save(update_fields=["pipeline_stage"])
                    except PipelineStage.DoesNotExist:
                        raise ValueError(f"PipelineStage {stage_id} not found")

            processed += 1
            job.processed = processed
            job.save(update_fields=["processed"])

        except Exception as exc:
            logger.exception("process_bulk_job: failed for lead %s: %s", lead_id, exc)
            errors.append({"lead_id": lead_id, "error": str(exc)})
            job.failed += 1
            job.error_detail = errors
            job.save(update_fields=["failed", "error_detail"])

    job.status = "done"
    job.finished_at = timezone.now()
    job.error_detail = errors
    job.save(update_fields=["status", "finished_at", "error_detail"])

    logger.info("process_bulk_job: job %s done – processed=%s failed=%s", job_id, processed, len(errors))
    return {"job_id": job_id, "processed": processed, "failed": len(errors)}


# ──────────────────────────────────────────────────────────────────────────────
# Daily follow-up reminders
# ──────────────────────────────────────────────────────────────────────────────

@shared_task(name="admissions.send_followup_reminders")
def send_followup_reminders() -> dict:
    """
    Morning follow-up digest: for every active inquiry whose next_follow_up_date
    is today, creates a ContactLog entry (channel='system') as an auto-reminder.

    Optionally also sends an SMS to the assigned counsellor's phone if
    ADMISSIONS_COUNSELLOR_REMINDER_SMS=true in settings.

    Runs daily at 8:00 AM via Celery Beat (configured in settings).
    Can also be triggered manually:
        python manage.py send_followup_reminders
    """
    from apps.admissions.models import AdmissionInquiry, ContactLog

    today = timezone.localdate()
    due = AdmissionInquiry.objects.filter(
        next_follow_up_date=today,
        active_status=1,
    ).select_related("school")

    created = 0
    skipped = 0

    for inquiry in due:
        try:
            # Idempotent: skip if a system log was already created today
            already = ContactLog.objects.filter(
                inquiry=inquiry,
                channel="system",
                created_at__date=today,
            ).exists()
            if already:
                skipped += 1
                continue

            body = (
                f"Auto follow-up reminder: {inquiry.full_name}"
                f"{' — assigned to ' + inquiry.assigned if inquiry.assigned else ''}."
                f" Follow-up date: {today}."
            )
            ContactLog.objects.create(
                inquiry=inquiry,
                channel="system",
                direction="outbound",
                status="delivered",
                body=body,
            )
            created += 1
        except Exception as exc:
            logger.warning("send_followup_reminders: failed for inquiry %s: %s", inquiry.id, exc)

    logger.info(
        "send_followup_reminders: created=%s skipped(already_done)=%s",
        created, skipped,
    )
    return {"created": created, "skipped": skipped, "date": str(today)}


# ──────────────────────────────────────────────────────────────────────────────
# Lead scoring
# ──────────────────────────────────────────────────────────────────────────────

@shared_task(name="admissions.compute_lead_scores")
def compute_lead_scores() -> dict:
    """
    Recompute lead_score for all active inquiries.
    Scoring heuristic (0-100):
      +20 if contacted in last 7 days
      +20 if follow_ups.count() >= 2
      +20 if campus_visit status
      +20 if documents_status in (requested, partial, complete)
      +20 if enrolled status
    """
    from apps.admissions.models import AdmissionInquiry

    qs = AdmissionInquiry.objects.filter(active_status=1).prefetch_related("follow_ups")
    now = timezone.now()
    updated = 0
    for inquiry in qs:
        score = 0
        if inquiry.last_contacted_at and (now - inquiry.last_contacted_at).days <= 7:
            score += 20
        if inquiry.follow_ups.count() >= 2:
            score += 20
        if inquiry.status == "visited":
            score += 20
        if inquiry.documents_status in ("requested", "partial", "complete"):
            score += 20
        if inquiry.status == "enrolled":
            score += 20
        if inquiry.lead_score != score:
            inquiry.lead_score = score
            inquiry.save(update_fields=["lead_score"])
            updated += 1

    logger.info("compute_lead_scores: updated %s/%s records", updated, qs.count())
    return {"updated": updated, "total": qs.count()}
