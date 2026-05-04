"""API справочника типов активностей: список, сид из CSV, удаление типа со слотами."""
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.dependencies import get_current_user, get_db
from app.models.activity_type import ActivityType
from app.models.user import User
from app.schemas.activity_type import ActivityTypeRead, SeedActivityTypesResult
from app.services.activity_type_delete import delete_activity_type_merged
from app.services.dataset_seed import seed_activity_types_from_csv

router = APIRouter(tags=["activity-types"])


@router.get("/activity-types", response_model=list[ActivityTypeRead])  # публичный список
def list_activity_types(db: Session = Depends(get_db)) -> list[ActivityType]:
    return list(db.scalars(select(ActivityType).order_by(ActivityType.name)))


@router.post("/activity-types/seed-from-dataset", response_model=SeedActivityTypesResult)  # импорт из CSV
def seed_activity_types(db: Session = Depends(get_db)) -> SeedActivityTypesResult:
    try:
        inserted, skipped, distinct = seed_activity_types_from_csv(
            db, settings.ACTIVITIES_DATASET_PATH
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except KeyError as e:
        raise HTTPException(
            status_code=400,
            detail="CSV must contain column 'Activity Type'",
        ) from e
    return SeedActivityTypesResult(
        inserted=inserted,
        skipped_existing=skipped,
        distinct_in_file=distinct,
    )


@router.delete(  # только авторизованный; удаляет и тип, и связанные слоты
    "/activity-types/{type_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_activity_type(
    type_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> Response:
    """Удаляет тип и все записи расписания, где этот тип использовался."""
    victim = db.get(ActivityType, type_id)
    if victim is None:
        raise HTTPException(status_code=404, detail="Type not found")
    delete_activity_type_merged(db, victim)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
