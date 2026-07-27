"""Celery tasks for the communication module (Quick Broadcast)."""

from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(name="communication.dispatch_broadcast")
def dispatch_broadcast_task(broadcast_id: int) -> None:
    from .broadcast import dispatch_broadcast

    try:
        dispatch_broadcast(broadcast_id)
    except Exception:
        logger.exception("Broadcast %s failed to dispatch", broadcast_id)
