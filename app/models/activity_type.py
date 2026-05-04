"""ORM-модель справочника типов занятий (имя + источник: dataset/user)."""
from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.schedule_entry import ScheduleEntry


class ActivityType(Base):
    __tablename__ = "activity_types"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    # "dataset" — из CSV; "user" — добавлено вручную / из приложения
    source: Mapped[str] = mapped_column(String(32), default="user")

    schedule_entries: Mapped[list[ScheduleEntry]] = relationship(
        back_populates="activity_type"
    )
