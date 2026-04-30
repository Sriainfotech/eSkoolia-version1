"""AI review prompt building, caching and provider integration."""
from __future__ import annotations

import hashlib
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 60 * 60 * 24 * 30  # 30 days
CACHE_PREFIX = "competitions:ai_review:"

PROMPT_PATH = Path(__file__).resolve().parent / "ai_prompts" / "canonical_review.txt"

_FALLBACK_PROMPT = (
    "You are an empathetic school coach. Produce a concise, age-appropriate, "
    "encouraging Performance Review with sections: Compliment, Performance Summary, "
    "Encouragement, Practical Tips. 120-220 words, supportive tone."
)


def load_canonical_prompt() -> str:
    try:
        return PROMPT_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        logger.warning("Canonical prompt file missing at %s", PROMPT_PATH)
        return _FALLBACK_PROMPT


@dataclass
class ReviewItem:
    student_id: int | None
    student_name: str
    student_age: int | None
    student_class: str
    competition_id: int | None
    competition_name: str
    competition_type: str
    competition_level: str
    position: str
    points: int
    personal_contribution: str
    performance_notes: str

    @classmethod
    def from_validated(cls, data: dict[str, Any]) -> "ReviewItem":
        return cls(
            student_id=data.get("student_id"),
            student_name=data.get("student_name", ""),
            student_age=data.get("student_age"),
            student_class=data.get("student_class", ""),
            competition_id=data.get("competition_id"),
            competition_name=data.get("competition_name", ""),
            competition_type=data.get("competition_type", ""),
            competition_level=data.get("competition_level", ""),
            position=data["position"],
            points=int(data.get("points") or 0),
            personal_contribution=data.get("personal_contribution", ""),
            performance_notes=data.get("performance_notes", ""),
        )


def hash_payload(item: ReviewItem) -> str:
    canonical = "|".join([
        str(item.student_id or ""),
        str(item.competition_id or ""),
        item.position or "",
        (item.personal_contribution or "").strip().lower(),
    ])
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def build_prompt(item: ReviewItem) -> str:
    base = load_canonical_prompt()
    allow_pii = bool(getattr(settings, "ALLOW_EXTERNAL_AI", False))
    name_block = item.student_name if allow_pii else "the student"
    structured = "\n".join([
        "",
        "Structured input:",
        f"- Student: {name_block}",
        f"- Age: {item.student_age or 'unspecified'}",
        f"- Class: {item.student_class or 'unspecified'}",
        f"- Competition: {item.competition_name or 'unspecified'}",
        f"- Type: {item.competition_type or 'unspecified'}",
        f"- Level: {item.competition_level or 'unspecified'}",
        f"- Position: {item.position}",
        f"- Points: {item.points}",
        f"- Personal contribution: {item.personal_contribution or 'none'}",
        f"- Teacher notes: {item.performance_notes or 'none'}",
    ])
    return f"{base.rstrip()}\n{structured}\n"


def fallback_review(item: ReviewItem) -> str:
    pos_label = {
        "1st": "first place", "2nd": "second place", "3rd": "third place",
        "consolation": "a consolation award", "participation": "active participation",
        "not_participated": "not participating this time",
    }.get(item.position, item.position)
    return (
        "Performance Review\n\n"
        "Compliment:\nWell done on showing courage and effort.\n\n"
        f"Performance Summary:\nYou achieved {pos_label} in {item.competition_name or 'this activity'}. "
        "Your willingness to take part is itself a strength to celebrate.\n\n"
        "Encouragement:\nKeep believing in your steady growth — you are on the right path.\n\n"
        "Practical Tips:\n- Practise regularly in small steps.\n- Ask a teacher or friend for feedback.\n"
        "- Reflect on one thing you can improve next time.\n"
    )


def call_provider(prompt: str) -> tuple[str, float]:
    """Call the configured AI provider. Returns (text, cost_estimate). Raises on failure."""
    provider = getattr(settings, "AI_PROVIDER", os.getenv("AI_PROVIDER", "stub")).lower()
    api_key = getattr(settings, "AI_API_KEY", os.getenv("AI_API_KEY", ""))

    if provider == "stub" or not api_key:
        raise RuntimeError("AI provider not configured")

    if provider == "openai":
        from openai import OpenAI  # type: ignore

        client = OpenAI(api_key=api_key)
        model = getattr(settings, "AI_MODEL", os.getenv("AI_MODEL", "gpt-4o-mini"))
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=500,
        )
        text = resp.choices[0].message.content or ""
        usage = getattr(resp, "usage", None)
        tokens = (usage.total_tokens if usage else 0) or 0
        cost = round(tokens * 0.000002, 6)
        return text.strip(), float(cost)

    raise RuntimeError(f"Unsupported AI provider: {provider}")


def get_or_generate_review(item: ReviewItem, user=None) -> dict[str, Any]:
    """Return review dict with cache + log handling."""
    from .models import AIRequestLog

    prompt_hash = hash_payload(item)
    cache_key = f"{CACHE_PREFIX}{prompt_hash}"
    cached = cache.get(cache_key)
    if cached:
        return {"review": cached, "prompt_hash": prompt_hash, "cache_hit": True, "fallback": False}

    prompt = build_prompt(item)
    fallback = False
    cost = 0.0
    error = ""
    try:
        review_text, cost = call_provider(prompt)
    except Exception as exc:
        logger.warning("AI provider failed, using fallback: %s", exc)
        review_text = fallback_review(item)
        fallback = True
        error = str(exc)[:500]

    cache.set(cache_key, review_text, CACHE_TTL_SECONDS)

    AIRequestLog.objects.create(
        user=user if user and getattr(user, "is_authenticated", False) else None,
        prompt_hash=prompt_hash,
        prompt=prompt,
        response=review_text,
        cost_estimate=cost,
        cache_hit=False,
        error=error,
    )

    return {"review": review_text, "prompt_hash": prompt_hash, "cache_hit": False, "fallback": fallback}
