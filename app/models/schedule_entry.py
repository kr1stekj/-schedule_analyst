"""ORM-модель одного интервала в календаре (дата, время, тип, пользователь)."""
from __future__ import annotations

import datetime as dt
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Date, ForeignKey, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.activity_type import ActivityType
    from app.models.user import User


class ScheduleEntry(Base):
    """Один интервал плана дня: время + вид занятия + описание."""

    __tablename__ = "schedule_entries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    schedule_date: Mapped[dt.date] = mapped_column(Date, index=True)
    start_time: Mapped[dt.time] = mapped_column(Time)
    end_time: Mapped[dt.time] = mapped_column(Time)
    activity_type_id: Mapped[int] = mapped_column(
        ForeignKey("activity_types.id", ondelete="RESTRICT")
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship(back_populates="schedule_entries")
    activity_type: Mapped["ActivityType"] = relationship(
        back_populates="schedule_entries"
    )
