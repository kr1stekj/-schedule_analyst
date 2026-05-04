"""Регистрация моделей для import app.models (metadata)."""
from app.models.activity_type import ActivityType
from app.models.schedule_entry import ScheduleEntry
from app.models.user import User

__all__ = ["User", "ActivityType", "ScheduleEntry"]
