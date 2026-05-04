"""Импорт уникальных имён активностей из CSV в таблицу activity_types."""
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.activity_type import ActivityType


def seed_activity_types_from_csv(session: Session, csv_path: Path) -> tuple[int, int, int]:
    """
    Читает колонку «Activity Type», добавляет уникальные значения в activity_types.
    Возвращает (inserted, skipped_existing, distinct_in_file).
    """
    path = Path(csv_path)
    if not path.is_file():
        raise FileNotFoundError(f"Dataset not found: {path}")

    import pandas as pd

    df = pd.read_csv(path, usecols=["Activity Type"])
    names = sorted({str(x).strip() for x in df["Activity Type"].dropna().unique()})
    distinct = len(names)

    inserted = 0
    skipped = 0
    for name in names:
        if not name:
            continue
        exists = session.scalar(select(ActivityType.id).where(ActivityType.name == name))
        if exists is not None:
            skipped += 1
            continue
        session.add(ActivityType(name=name, source="dataset"))
        inserted += 1
    session.commit()
    return inserted, skipped, distinct
