"""Схемы создания и чтения слота расписания для API."""
import datetime as dt
from typing import Optional

from pydantic import BaseModel, Field


class ScheduleEntryCreate(BaseModel):
    schedule_date: dt.date
    start_time: str = Field(..., description="HH:MM или HH:MM:SS")
    end_time: str
    activity_type_name: str = Field(..., min_length=1, max_length=128)
    description: Optional[str] = Field(None, max_length=4000)


class ScheduleEntryRead(BaseModel):
    id: int
    schedule_date: dt.date
    start_time: str
    end_time: str
    activity_type_name: str
    description: Optional[str] = None


class ScheduleSummaryActivity(BaseModel):
    activity_type_name: str
    total_minutes: int
    average_minutes_per_day: float
    entries_count: int
    days_count: int
    frequency_per_day: float


class ScheduleSummaryEntry(BaseModel):
    schedule_date: dt.date
    start_time: str
    end_time: str
    activity_type_name: str
    description: Optional[str] = None
    duration_minutes: int


class ScheduleSummaryRead(BaseModel):
    start_date: dt.date
    end_date: dt.date
    days_total: int
    total_scheduled_minutes: int
    average_scheduled_minutes_per_day: float
    total_free_minutes: int
    average_free_minutes_per_day: float
    activities: list[ScheduleSummaryActivity]
    entries: list[ScheduleSummaryEntry]
