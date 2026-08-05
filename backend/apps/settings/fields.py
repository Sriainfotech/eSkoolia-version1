"""Field-level encryption for secrets stored in Settings models (e.g. SMTP
password). No field-encryption library is installed project-wide (only the
transitive `cryptography` dependency) — this hand-rolls a small Fernet-backed
CharField rather than adding a new dependency for one field.

Deliberately keyed by its own env var (SETTINGS_FIELD_ENCRYPTION_KEY), never
by Django's SECRET_KEY — SECRET_KEY already signs JWTs and sessions; reusing
it for data-at-rest encryption mixes concerns and widens the blast radius of
either secret leaking.
"""
import os

from cryptography.fernet import Fernet, InvalidToken
from django.core.exceptions import ImproperlyConfigured
from django.db import models


def _get_fernet() -> Fernet:
    key = os.getenv("SETTINGS_FIELD_ENCRYPTION_KEY")
    if not key:
        raise ImproperlyConfigured(
            "SETTINGS_FIELD_ENCRYPTION_KEY is not set. Generate one with "
            "`python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"` "
            "and set it in the environment before using apps.settings encrypted fields."
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


class EncryptedCharField(models.CharField):
    """CharField that transparently encrypts on save and decrypts on load.

    Ciphertext is base64/urlsafe text (Fernet output), so `max_length` must
    comfortably exceed the plaintext length — callers should size this field
    generously (e.g. 512 for a password that's realistically <128 chars).
    """

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        if value in (None, ""):
            return value
        return _get_fernet().encrypt(value.encode()).decode()

    def from_db_value(self, value, expression, connection):
        if value in (None, ""):
            return value
        try:
            return _get_fernet().decrypt(value.encode()).decode()
        except InvalidToken:
            # Value predates encryption being enabled, or the key rotated —
            # surface as unreadable rather than silently returning ciphertext.
            return ""

    def to_python(self, value):
        return value
