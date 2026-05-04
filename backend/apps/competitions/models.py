from django.conf import settings
from django.db import models


class House(models.Model):
    school = models.ForeignKey(
        "tenancy.School", on_delete=models.CASCADE, related_name="competition_houses"
    )
    name = models.CharField(max_length=80)
    color = models.CharField(max_length=20, blank=True)
    motto = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "competitions_house"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["school", "name"], name="uq_house_school_name"),
        ]

    def __str__(self) -> str:
        return self.name


class Club(models.Model):
    school = models.ForeignKey(
        "tenancy.School", on_delete=models.CASCADE, related_name="competition_clubs"
    )
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "competitions_club"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["school", "name"], name="uq_club_school_name"),
        ]

    def __str__(self) -> str:
        return self.name


class Competition(models.Model):
    LEVEL_CHOICES = [
        ("intra_class", "Intra-Class"),
        ("inter_class", "Inter-Class"),
        ("intra_school", "Intra-School"),
        ("inter_school", "Inter-School"),
        ("district", "District"),
        ("state", "State"),
        ("national", "National"),
        ("international", "International"),
    ]
    TYPE_CHOICES = [
        ("academic", "Academic"),
        ("sports", "Sports"),
        ("cultural", "Cultural"),
        ("arts", "Arts"),
        ("debate", "Debate"),
        ("stem", "STEM"),
        ("other", "Other"),
    ]

    school = models.ForeignKey(
        "tenancy.School", on_delete=models.CASCADE, related_name="competitions"
    )
    name = models.CharField(max_length=200)
    date = models.DateField()
    level = models.CharField(max_length=30, choices=LEVEL_CHOICES, default="intra_school")
    comp_type = models.CharField(max_length=30, choices=TYPE_CHOICES, default="academic")
    location = models.CharField(max_length=200, blank=True)
    opponent = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="competitions_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "competitions_competition"
        ordering = ["-date", "-id"]

    def __str__(self) -> str:
        return f"{self.name} ({self.date})"


class Team(models.Model):
    competition = models.ForeignKey(
        Competition, on_delete=models.CASCADE, related_name="teams"
    )
    name = models.CharField(max_length=120)
    members = models.ManyToManyField(
        "students.Student", blank=True, related_name="competition_teams"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "competitions_team"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Result(models.Model):
    POSITION_CHOICES = [
        ("1st", "1st Place"),
        ("2nd", "2nd Place"),
        ("3rd", "3rd Place"),
        ("consolation", "Consolation"),
        ("participation", "Participation"),
        ("not_participated", "Not Participated"),
    ]
    DEFAULT_POINTS = {
        "1st": 10, "2nd": 7, "3rd": 5,
        "consolation": 3, "participation": 1, "not_participated": 0,
    }

    competition = models.ForeignKey(Competition, on_delete=models.CASCADE, related_name="results")
    student = models.ForeignKey(
        "students.Student", on_delete=models.CASCADE,
        null=True, blank=True, related_name="competition_results",
    )
    team = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True, blank=True, related_name="results")
    house = models.ForeignKey(House, on_delete=models.SET_NULL, null=True, blank=True, related_name="results")
    club = models.ForeignKey(Club, on_delete=models.SET_NULL, null=True, blank=True, related_name="results")
    position = models.CharField(max_length=20, choices=POSITION_CHOICES)
    points = models.IntegerField(default=0)
    personal_contribution = models.TextField(blank=True)
    performance_notes = models.TextField(blank=True)

    ai_generated = models.BooleanField(default=False)
    ai_prompt_hash = models.CharField(max_length=64, blank=True, db_index=True)
    ai_response = models.TextField(blank=True)
    ai_timestamp = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "competitions_result"
        ordering = ["competition_id", "id"]
        indexes = [
            models.Index(fields=["competition", "position"]),
            models.Index(fields=["student"]),
        ]

    def save(self, *args, **kwargs):
        if not self.points:
            self.points = self.DEFAULT_POINTS.get(self.position, 0)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        who = self.student_id or self.team_id or "?"
        return f"Result#{self.pk} comp={self.competition_id} subject={who} pos={self.position}"


class AIRequestLog(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="ai_request_logs",
    )
    prompt_hash = models.CharField(max_length=64, db_index=True)
    prompt = models.TextField()
    response = models.TextField(blank=True)
    cost_estimate = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    cache_hit = models.BooleanField(default=False)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "competitions_ai_request_log"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"AIRequestLog#{self.pk} hit={self.cache_hit}"
