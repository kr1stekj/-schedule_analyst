"""Удаление activity_type вместе со слотами, где он используется."""

from __future__ import annotations

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models.activity_type import ActivityType
from app.models.schedule_entry import ScheduleEntry


def delete_activity_type_merged(db: Session, victim: ActivityType) -> None:
    """Удаляет тип и все связанные слоты расписания (жёсткое удаление).  !!!не работает пока"""
    db.execute(delete(ScheduleEntry).where(ScheduleEntry.activity_type_id == victim.id))
    db.delete(victim)
    db.commit()
