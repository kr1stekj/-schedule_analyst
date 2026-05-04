"""Операции с расписанием и разрешение строки активности → ActivityType."""
from typing import Optional

import datetime as dt

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.activity_type import ActivityType
from app.models.schedule_entry import ScheduleEntry
from app.services.activity_fuzzy import best_fuzzy_activity_slug, best_fuzzy_activity_type
from app.services.activity_normalize import (
    canonical_slug,
    display_name_for_new_row,
    variant_set_for_slug,
)


def get_or_create_activity_type(db: Session, name: str) -> ActivityType:
    """Точное совпадение по вариантам → fuzzy → иначе новая строка в справочнике."""
    raw = (name or "").strip() or "—"
    slug = canonical_slug(raw)
    variants = variant_set_for_slug(slug)
    existing = db.scalar(
        select(ActivityType)
        .where(func.lower(func.trim(ActivityType.name)).in_(list(variants)))
        .order_by(ActivityType.id)
        .limit(1)
    )
    if existing is not None:
        return existing
    # Если попали в известную группу (read/eat/drive/...),
    # не используем fuzzy: иначе возможны ложные склейки вроде reading -> eating.
    if len(variants) > 1:
        label = display_name_for_new_row(raw, slug)
        if len(label) > 128:
            label = label[:128]
        row = ActivityType(name=label, source="user")
        db.add(row)
        db.commit()
        db.refresh(row)
        return row
    fuzzy = best_fuzzy_activity_type(db, raw)
    if fuzzy is not None:
        return fuzzy
    fuzzy_slug = best_fuzzy_activity_slug(raw)
    if fuzzy_slug is not None:
        label = display_name_for_new_row(raw, fuzzy_slug)
        row = ActivityType(name=label, source="user")
        db.add(row)
        db.commit()
        db.refresh(row)
        return row
    label = display_name_for_new_row(raw, slug)
    if len(label) > 128:
        label = label[:128]
    row = ActivityType(name=label, source="user")
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_entries(
    db: Session,
    user_id: int,
    start_date: dt.date,
    end_date: dt.date,
) -> list[ScheduleEntry]:
    return list(
        db.scalars(
            select(ScheduleEntry)
            .options(joinedload(ScheduleEntry.activity_type))
            .where(
                ScheduleEntry.user_id == user_id,
                ScheduleEntry.schedule_date >= start_date,
                ScheduleEntry.schedule_date <= end_date,
            )
            .order_by(ScheduleEntry.schedule_date, ScheduleEntry.start_time)
        ).all()
    )


def get_entry_for_user(db: Session, entry_id: int, user_id: int) -> Optional[ScheduleEntry]:
    row = db.get(ScheduleEntry, entry_id)
    if row is None or row.user_id != user_id:
        return None
    return row


def delete_entry(db: Session, entry: ScheduleEntry) -> None:
    db.delete(entry)
    db.commit()
