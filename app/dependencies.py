"""Depends для FastAPI: сессия БД и текущий пользователь из Bearer JWT."""

from typing import Annotated, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import TOKEN_TYPE_ACCESS, decode_token_safe
from app.crud import user as user_crud
from app.database import get_db
from app.models.user import User

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    payload = decode_token_safe(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    if payload.get("typ") != TOKEN_TYPE_ACCESS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Wrong token type",
        )
    sub = payload.get("sub")
    if sub is None or not str(sub).isdigit():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
        )
    user = user_crud.get_by_id(db, int(sub))
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


def get_current_user_optional(
    credentials: Annotated[
        Optional[HTTPAuthorizationCredentials],
        Depends(optional_security),
    ],
    db: Annotated[Session, Depends(get_db)],
) -> Optional[User]:
    if credentials is None:
        return None
    payload = decode_token_safe(credentials.credentials)
    if payload is None or payload.get("typ") != TOKEN_TYPE_ACCESS:
        return None
    sub = payload.get("sub")
    if sub is None or not str(sub).isdigit():
        return None
    user = user_crud.get_by_id(db, int(sub))
    if user is None or not user.is_active:
        return None
    return user


__all__ = ["get_db", "get_current_user", "get_current_user_optional", "security"]
