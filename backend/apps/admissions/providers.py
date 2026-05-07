"""
Provider adapters for outreach channels.
All adapters implement a common interface so they can be swapped via settings.

Environment variables:
  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, TWILIO_WHATSAPP_FROM
  SMS_PROVIDER  (default: "twilio")
  AI_PROVIDER   (default: "openai" | "azure_openai" | "stub")
  OPENAI_API_KEY
"""

from __future__ import annotations

import logging
import os
from abc import ABC, abstractmethod
from typing import Any

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# Abstract base
# ──────────────────────────────────────────────────────────────────────────────

class AbstractSMSAdapter(ABC):
    @abstractmethod
    def send_sms(self, to: str, body: str) -> dict[str, Any]:
        """Send SMS. Returns dict with at least `message_id` and `status`."""

    @abstractmethod
    def send_whatsapp(self, to: str, body: str, template_id: str | None = None) -> dict[str, Any]:
        """Send WhatsApp message. Returns dict with at least `message_id` and `status`."""

    @abstractmethod
    def initiate_call(self, to: str, from_: str | None = None) -> dict[str, Any]:
        """Initiate click-to-call. Returns dict with `call_session_id` and `call_url`."""


# ──────────────────────────────────────────────────────────────────────────────
# Twilio adapter
# ──────────────────────────────────────────────────────────────────────────────

class TwilioAdapter(AbstractSMSAdapter):
    """
    Production Twilio adapter.
    Install twilio: `pip install twilio`
    """

    def __init__(self) -> None:
        self.account_sid: str = os.environ.get("TWILIO_ACCOUNT_SID", "")
        self.auth_token: str = os.environ.get("TWILIO_AUTH_TOKEN", "")
        self.from_number: str = os.environ.get("TWILIO_FROM_NUMBER", "")
        self.whatsapp_from: str = os.environ.get("TWILIO_WHATSAPP_FROM", "")

        if not all([self.account_sid, self.auth_token, self.from_number]):
            logger.warning("TwilioAdapter: missing credentials; calls will be no-ops")

    def _client(self):  # type: ignore[return]
        try:
            from twilio.rest import Client  # type: ignore[import]
            return Client(self.account_sid, self.auth_token)
        except ImportError:
            raise RuntimeError("twilio package not installed. Run: pip install twilio")

    def send_sms(self, to: str, body: str) -> dict[str, Any]:
        client = self._client()
        message = client.messages.create(body=body, from_=self.from_number, to=to)
        return {"message_id": message.sid, "status": message.status}

    def send_whatsapp(self, to: str, body: str, template_id: str | None = None) -> dict[str, Any]:
        client = self._client()
        wa_to = f"whatsapp:{to}" if not to.startswith("whatsapp:") else to
        wa_from = self.whatsapp_from or f"whatsapp:{self.from_number}"
        message = client.messages.create(body=body, from_=wa_from, to=wa_to)
        return {"message_id": message.sid, "status": message.status}

    def initiate_call(self, to: str, from_: str | None = None) -> dict[str, Any]:
        client = self._client()
        from_number = from_ or self.from_number
        call = client.calls.create(
            twiml="<Response><Say>This is a call from your school admissions team. Please hold.</Say></Response>",
            from_=from_number,
            to=to,
        )
        return {"call_session_id": call.sid, "call_url": f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Calls/{call.sid}.json"}


# ──────────────────────────────────────────────────────────────────────────────
# Stub adapter (used in tests / when provider not configured)
# ──────────────────────────────────────────────────────────────────────────────

class StubAdapter(AbstractSMSAdapter):
    """No-op adapter that logs instead of sending real messages. Use in dev/test."""

    def send_sms(self, to: str, body: str) -> dict[str, Any]:
        logger.info("[STUB] SMS to=%s body=%s", to, body[:60])
        return {"message_id": f"stub_sms_{to}", "status": "delivered"}

    def send_whatsapp(self, to: str, body: str, template_id: str | None = None) -> dict[str, Any]:
        logger.info("[STUB] WhatsApp to=%s body=%s", to, body[:60])
        return {"message_id": f"stub_wa_{to}", "status": "delivered"}

    def initiate_call(self, to: str, from_: str | None = None) -> dict[str, Any]:
        logger.info("[STUB] Call to=%s", to)
        return {"call_session_id": f"stub_call_{to}", "call_url": "https://example.com/stub-call"}


# ──────────────────────────────────────────────────────────────────────────────
# Factory
# ──────────────────────────────────────────────────────────────────────────────

def get_sms_adapter() -> AbstractSMSAdapter:
    provider = os.environ.get("SMS_PROVIDER", "stub").lower()
    if provider == "twilio":
        return TwilioAdapter()
    return StubAdapter()


# ──────────────────────────────────────────────────────────────────────────────
# AI Service
# ──────────────────────────────────────────────────────────────────────────────

class AIMessageService:
    """
    Generates two message variants (Formal + Friendly) for admissions outreach.
    Set AI_PROVIDER=openai and OPENAI_API_KEY to use GPT; otherwise returns stubs.
    """

    def __init__(self) -> None:
        self.provider = os.environ.get("AI_PROVIDER", "stub").lower()
        self.openai_api_key = os.environ.get("OPENAI_API_KEY", "")
        self.model = os.environ.get("AI_MODEL", "gpt-4o-mini")

    def generate(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
    ) -> dict[str, str]:
        """
        Returns {'variant_a': str, 'variant_b': str, 'prompt_used': str}.
        PII is NOT included in `prompt_used` when logged.
        """
        if self.provider == "openai":
            return self._openai(system_prompt=system_prompt, user_prompt=user_prompt)
        return self._stub(user_prompt=user_prompt)

    def _openai(self, *, system_prompt: str, user_prompt: str) -> dict[str, str]:
        try:
            import openai  # type: ignore[import]
        except ImportError:
            raise RuntimeError("openai package not installed. Run: pip install openai")

        client = openai.OpenAI(api_key=self.openai_api_key)
        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=500,
            temperature=0.7,
        )
        raw = response.choices[0].message.content or ""
        variant_a, variant_b = self._parse_variants(raw)
        return {"variant_a": variant_a, "variant_b": variant_b, "prompt_used": "[REDACTED]"}

    def _stub(self, *, user_prompt: str) -> dict[str, str]:
        logger.info("[STUB AI] Generating message variants")
        return {
            "variant_a": "Dear Parent, we are pleased to invite your child for admission. Kindly contact us at your earliest convenience.",
            "variant_b": "Hi! We'd love to have your child join us. Give us a call anytime — we're here to help! 😊",
            "prompt_used": "[STUB – no real AI call]",
        }

    @staticmethod
    def _parse_variants(raw: str) -> tuple[str, str]:
        """Parse OpenAI response that contains Variant A and Variant B."""
        import re
        a_match = re.search(r"(?:Variant A|1\)|Formal)[:\s]*(.*?)(?=Variant B|2\)|Friendly|$)", raw, re.S | re.I)
        b_match = re.search(r"(?:Variant B|2\)|Friendly)[:\s]*(.*?)$", raw, re.S | re.I)
        a = a_match.group(1).strip() if a_match else raw[:220]
        b = b_match.group(1).strip() if b_match else raw[:220]
        return a, b
