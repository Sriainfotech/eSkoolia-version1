from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient


class AIReviewCachingTests(TestCase):
    def setUp(self):
        cache.clear()
        self.User = get_user_model()
        self.staff = self.User.objects.create_user(
            username="reviewer", email="r@example.com", password="x", is_staff=True
        )
        self.client = APIClient()
        self.client.force_authenticate(self.staff)

    def _payload(self):
        return {
            "items": [{
                "student_id": 1,
                "student_name": "Aman",
                "competition_id": 10,
                "competition_name": "Quiz",
                "position": "1st",
                "points": 10,
                "personal_contribution": "Led the team",
            }]
        }

    @mock.patch("apps.competitions.ai.call_provider")
    def test_second_call_hits_cache(self, mocked):
        mocked.return_value = ("Performance Review\n\nCompliment:\nGreat.\n", 0.001)

        r1 = self.client.post("/api/v1/competitions/ai/review/", self._payload(), format="json")
        self.assertEqual(r1.status_code, 200, r1.content)
        self.assertFalse(r1.data["results"][0]["cache_hit"])
        first_hash = r1.data["results"][0]["prompt_hash"]
        self.assertEqual(mocked.call_count, 1)

        r2 = self.client.post("/api/v1/competitions/ai/review/", self._payload(), format="json")
        self.assertEqual(r2.status_code, 200)
        self.assertTrue(r2.data["results"][0]["cache_hit"])
        self.assertEqual(r2.data["results"][0]["prompt_hash"], first_hash)
        self.assertEqual(mocked.call_count, 1, "Provider must NOT be called on cache hit")

    @mock.patch("apps.competitions.ai.call_provider", side_effect=RuntimeError("boom"))
    def test_fallback_when_provider_fails(self, _mocked):
        r = self.client.post("/api/v1/competitions/ai/review/", self._payload(), format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertTrue(r.data["results"][0]["fallback"])
        self.assertIn("Performance Review", r.data["results"][0]["review"])

    def test_non_staff_forbidden(self):
        user = self.User.objects.create_user(username="u", email="u@e.com", password="x")
        c = APIClient()
        c.force_authenticate(user)
        r = c.post("/api/v1/competitions/ai/review/", self._payload(), format="json")
        self.assertEqual(r.status_code, 403)
