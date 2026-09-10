"""
Real-time push for InAppMessage, reusing apps.chat's existing per-user
WebSocket group (ws/chat/, group name f"user_{id}") instead of standing up
a second WebSocket path. Routed through ChatConsumer.portal_notification —
a distinct event type from chat_message — so a portal notification can
never be mistaken for a Conversation message by the existing admin
ChatWindow if it's ever mounted for the same account.

Kept out of apps.teacher_portal / apps.parent_portal so neither portal app
has to import from the other, and out of apps.communication.views (the
admin-facing message API) since this is portal-only plumbing.
"""


def push_new_message(message) -> None:
    """
    Notifies message.recipient's browser over WebSocket that a new
    InAppMessage arrived. Best-effort: a missing/misconfigured channel
    layer (e.g. Redis briefly down) must never break sending the message
    itself, so every failure is swallowed here.
    """
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        layer = get_channel_layer()
        if layer is None:
            return

        async_to_sync(layer.group_send)(
            f"user_{message.recipient_id}",
            {
                "type": "portal_notification",
                "notification": {
                    "kind": "message",
                    "id": message.id,
                    "subject": message.subject,
                    "sender_id": message.sender_id,
                    "created_at": message.created_at.isoformat(),
                },
            },
        )
    except Exception:
        pass
