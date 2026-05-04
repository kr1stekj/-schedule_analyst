"""Схемы списка типов и результата сидирования из CSV."""
from pydantic import BaseModel, ConfigDict


class ActivityTypeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    source: str


class SeedActivityTypesResult(BaseModel):
    inserted: int
    skipped_existing: int
    distinct_in_file: int
