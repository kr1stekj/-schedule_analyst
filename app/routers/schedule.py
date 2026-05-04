"""CRUD слотов расписания текущего пользователя (только с JWT)."""
import datetime as dt
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.crud import schedule as schedule_crud
from app.dependencies import get_current_user, get_db
from app.models.schedule_entry import ScheduleEntry
from app.models.user import User
from app.schemas.schedule import (
    ScheduleEntryCreate,
    ScheduleEntryRead,
    ScheduleSummaryActivity,
    ScheduleSummaryEntry,
    ScheduleSummaryRead,
)

router = APIRouter(prefix="/schedule", tags=["schedule"])
DAY_MINUTES = 24 * 60
DEFAULT_SLEEP_MINUTES = 8 * 60
SLEEP_NAMES = {"sleep", "sleeps", "sleeping", "slept", "сон", "спать"}


def _parse_hhmm(s: str) -> dt.time:
    """Строка времени из JSON → объект time (иначе 400)."""
    s = (s or "").strip()
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            return datetime.strptime(s, fmt).time()
        except ValueError:
            continue
    raise HTTPException(status_code=400, detail=f"Invalid time format: {s!r}")


def _to_row(entry: ScheduleEntry) -> ScheduleEntryRead:
    at_name = entry.activity_type.name if entry.activity_type else "—"
    return ScheduleEntryRead(
        id=entry.id,
        schedule_date=entry.schedule_date,
        start_time=entry.start_time.strftime("%H:%M"),
        end_time=entry.end_time.strftime("%H:%M"),
        activity_type_name=at_name,
        description=entry.description,
    )


def _duration_minutes(start: dt.time, end: dt.time) -> int:
    start_minutes = start.hour * 60 + start.minute
    end_minutes = end.hour * 60 + end.minute
    if end_minutes <= start_minutes:
        end_minutes += DAY_MINUTES
    return end_minutes - start_minutes


def _is_sleep_activity(name: str) -> bool:
    return name.strip().lower() in SLEEP_NAMES


@router.get("", response_model=list[ScheduleEntryRead])  # диапазон дат query params
def list_schedule(
    start_date: dt.date,
    end_date: dt.date,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ScheduleEntryRead]:
    if end_date < start_date:
        raise HTTPException(status_code=400, detail="end_date must be >= start_date")
    rows = schedule_crud.list_entries(db, user.id, start_date, end_date)
    return [_to_row(e) for e in rows]


@router.get("/summary", response_model=ScheduleSummaryRead)
def schedule_summary(
    start_date: dt.date,
    end_date: dt.date,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScheduleSummaryRead:
    if end_date < start_date:
        raise HTTPException(status_code=400, detail="end_date must be >= start_date")
    rows = schedule_crud.list_entries(db, user.id, start_date, end_date)

    by_activity: dict[str, dict[str, object]] = {}
    entries: list[ScheduleSummaryEntry] = []
    dates_with_entries: set[dt.date] = set()
    dates_with_sleep: set[dt.date] = set()
    total_scheduled = 0
    for row in rows:
        name = row.activity_type.name if row.activity_type else "—"
        duration = _duration_minutes(row.start_time, row.end_time)
        dates_with_entries.add(row.schedule_date)
        total_scheduled += duration
        if _is_sleep_activity(name):
            dates_with_sleep.add(row.schedule_date)
        bucket = by_activity.setdefault(name, {"minutes": 0, "entries": 0, "days": set()})
        bucket["minutes"] = int(bucket["minutes"]) + duration
        bucket["entries"] = int(bucket["entries"]) + 1
        days = bucket["days"]
        if isinstance(days, set):
            days.add(row.schedule_date)
        entries.append(
            ScheduleSummaryEntry(
                schedule_date=row.schedule_date,
                start_time=row.start_time.strftime("%H:%M"),
                end_time=row.end_time.strftime("%H:%M"),
                activity_type_name=name,
                description=row.description,
                duration_minutes=duration,
            )
        )

    activities: list[ScheduleSummaryActivity] = []
    for name, data in by_activity.items():
        minutes = int(data["minutes"])
        count = int(data["entries"])
        days = data["days"]
        days_count = len(days) if isinstance(days, set) else 0
        activity_days = max(1, days_count)
        activities.append(
            ScheduleSummaryActivity(
                activity_type_name=name,
                total_minutes=minutes,
                average_minutes_per_day=round(minutes / activity_days, 2),
                entries_count=count,
                days_count=days_count,
                frequency_per_day=round(count / activity_days, 2),
            )
        )
    activities.sort(key=lambda x: (-x.total_minutes, x.activity_type_name.lower()))

    days_total = len(dates_with_entries)
    average_divisor = max(1, days_total)
    days_without_sleep = len(dates_with_entries - dates_with_sleep)
    total_possible = days_total * DAY_MINUTES
    total_free = max(0, total_possible - total_scheduled - days_without_sleep * DEFAULT_SLEEP_MINUTES)
    return ScheduleSummaryRead(
        start_date=start_date,
        end_date=end_date,
        days_total=days_total,
        total_scheduled_minutes=total_scheduled,
        average_scheduled_minutes_per_day=round(total_scheduled / average_divisor, 2),
        total_free_minutes=total_free,
        average_free_minutes_per_day=round(total_free / average_divisor, 2),
        activities=activities,
        entries=entries,
    )


@router.post("", response_model=ScheduleEntryRead, status_code=status.HTTP_201_CREATED)  # новый слот
def create_schedule_entry(
    body: ScheduleEntryCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScheduleEntryRead:
    st = _parse_hhmm(body.start_time)
    et = _parse_hhmm(body.end_time)

    at = schedule_crud.get_or_create_activity_type(db, body.activity_type_name)
    midnight = dt.time(0, 0)
    entries = [
        ScheduleEntry(
            user_id=user.id,
            schedule_date=body.schedule_date,
            start_time=st,
            end_time=midnight if et <= st else et,
            activity_type_id=at.id,
            description=body.description,
        )
    ]
    if et <= st and et != midnight:
        entries.append(
            ScheduleEntry(
                user_id=user.id,
                schedule_date=body.schedule_date + dt.timedelta(days=1),
                start_time=midnight,
                end_time=et,
                activity_type_id=at.id,
                description=body.description,
            )
        )
    db.add_all(entries)
    db.commit()
    new_id = entries[0].id
    row = db.scalar(
        select(ScheduleEntry)
        .options(joinedload(ScheduleEntry.activity_type))
        .where(ScheduleEntry.id == new_id)
    )
    if row is None:
        raise HTTPException(status_code=500, detail="Failed to load created entry")
    return _to_row(row)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)  # только свой слот
def delete_schedule_entry(
    entry_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    entry = schedule_crud.get_entry_for_user(db, entry_id, user.id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    schedule_crud.delete_entry(db, entry)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
