import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")

app = Celery("school_erp")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

# ── Celery Beat — scheduled tasks ─────────────────────────────────────────
# Defined here (not in settings) so crontab is only imported by the Celery
# worker/beat process, never by daphne/Django at ASGI startup time.
app.conf.beat_schedule = {
    # Run every morning at 8:00 AM (server local time)
    "admissions-morning-followup-digest": {
        "task": "admissions.send_followup_reminders",
        "schedule": crontab(hour=8, minute=0),
    },
    # Recompute lead scores every day at 7:45 AM
    "admissions-compute-lead-scores": {
        "task": "admissions.compute_lead_scores",
        "schedule": crontab(hour=7, minute=45),
    },
}
