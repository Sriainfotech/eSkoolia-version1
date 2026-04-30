from django.contrib import admin

from .models import AIRequestLog, Club, Competition, House, Result, Team


@admin.register(House)
class HouseAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "school", "color")
    search_fields = ("name",)


@admin.register(Club)
class ClubAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "school")
    search_fields = ("name",)


@admin.register(Competition)
class CompetitionAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "date", "level", "comp_type", "school", "created_by")
    list_filter = ("level", "comp_type", "date")
    search_fields = ("name", "location", "opponent")


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "competition")
    filter_horizontal = ("members",)


@admin.register(Result)
class ResultAdmin(admin.ModelAdmin):
    list_display = ("id", "competition", "student", "team", "position", "points", "ai_generated")
    list_filter = ("position", "ai_generated")
    search_fields = ("competition__name",)


@admin.register(AIRequestLog)
class AIRequestLogAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "prompt_hash", "cache_hit", "cost_estimate", "created_at")
    list_filter = ("cache_hit", "created_at")
    search_fields = ("prompt_hash",)
    readonly_fields = ("user", "prompt_hash", "prompt", "response", "cost_estimate", "cache_hit", "error", "created_at")
