"""
Management command: send_followup_reminders

Manually triggers the Celery task that creates system ContactLog
entries for all active inquiries whose next follow-up date is today.

Usage:
    python manage.py send_followup_reminders
    python manage.py send_followup_reminders --date 2026-04-15
"""

from __future__ import annotations

from datetime import date

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone


class Command(BaseCommand):
    help = "Generate auto follow-up reminders for today (or a given date)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--date",
            type=str,
            default=None,
            help="ISO date (YYYY-MM-DD) to run reminders for. Defaults to today.",
        )

    def handle(self, *args, **options):
        from apps.admissions.models import AdmissionInquiry, ContactLog

        if options["date"]:
            try:
                target_date = date.fromisoformat(options["date"])
            except ValueError:
                raise CommandError(f"Invalid date format: {options['date']}. Use YYYY-MM-DD.")
        else:
            target_date = timezone.localdate()

        self.stdout.write(f"Running follow-up reminders for date: {target_date}")

        due = AdmissionInquiry.objects.filter(
            next_follow_up_date=target_date,
            active_status=1,
        )

        created = 0
        skipped = 0

        for inquiry in due:
            already = ContactLog.objects.filter(
                inquiry=inquiry,
                channel="system",
                created_at__date=target_date,
            ).exists()

            if already:
                skipped += 1
                continue

            body = (
                f"Auto follow-up reminder: {inquiry.full_name}"
                f"{' — assigned to ' + inquiry.assigned if inquiry.assigned else ''}."
                f" Follow-up date: {target_date}."
            )
            ContactLog.objects.create(
                inquiry=inquiry,
                channel="system",
                direction="outbound",
                status="delivered",
                body=body,
            )
            created += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Done — created: {created}, already existing (skipped): {skipped}"
            )
        )
