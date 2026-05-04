"""Регистрация, вход, JWT, TOTP 2FA (setup / confirm / disable)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import (
    TOKEN_TYPE_2FA_PENDING,
    create_2fa_challenge_token,
    create_access_token,
    decode_token_safe,
    hash_password,
    verify_password,
)
from app.crud import user as user_crud
from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.auth import (
    Complete2FARequest,
    LoginRequest,
    LoginResponse,
    TokenResponse,
    TOTPConfirmRequest,
    TOTPDisableRequest,
    TOTPSetupResponse,
    UserPublic,
    UserRegister,
)
from app.services import totp as totp_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _normalize_email(email: str) -> str:
    return str(email).strip().lower()


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)  # новый аккаунт
def register(body: UserRegister, db: Session = Depends(get_db)) -> User:
    email = _normalize_email(body.email)
    if user_crud.get_by_email(db, email) is not None:
        raise HTTPException(status_code=400, detail="Email already registered")
    return user_crud.create_user(db, email, hash_password(body.password))


@router.post("/login", response_model=LoginResponse)  # пароль; при 2FA — challenge или сразу код
def login(body: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    email = _normalize_email(body.email)
    user = user_crud.get_by_email(db, email)
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    if user.totp_enabled:
        if body.totp_code:
            if not user.totp_secret or not totp_service.verify(
                user.totp_secret, body.totp_code
            ):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid 2FA code",
                )
            token = create_access_token(user.id)
            return LoginResponse(access_token=token, requires_2fa=False)

        challenge = create_2fa_challenge_token(user.id)
        return LoginResponse(
            requires_2fa=True,
            challenge_token=challenge,
        )

    token = create_access_token(user.id)
    return LoginResponse(access_token=token, requires_2fa=False)


@router.post("/login/2fa", response_model=TokenResponse)  # обмен challenge на access JWT
def login_complete_2fa(body: Complete2FARequest, db: Session = Depends(get_db)) -> TokenResponse:
    payload = decode_token_safe(body.challenge_token)
    if payload is None or payload.get("typ") != TOKEN_TYPE_2FA_PENDING:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired challenge",
        )
    sub = payload.get("sub")
    if sub is None or not str(sub).isdigit():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid challenge",
        )
    user = user_crud.get_by_id(db, int(sub))
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    if not user.totp_enabled or not user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA is not enabled for this account")
    if not totp_service.verify(user.totp_secret, body.totp_code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid 2FA code",
        )
    return TokenResponse(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserPublic)  # профиль по Bearer
def read_me(user: User = Depends(get_current_user)) -> User:
    return user


@router.post("/2fa/setup", response_model=TOTPSetupResponse)  # секрет + QR (ещё не включено)
def totp_setup(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> TOTPSetupResponse:
    if user.totp_enabled:
        raise HTTPException(
            status_code=400,
            detail="2FA already enabled; disable it before generating a new secret",
        )
    secret = totp_service.new_secret()
    user_crud.set_totp_secret(db, user, secret)
    url = totp_service.provisioning_uri(secret, user.email)
    qr = totp_service.qr_png_base64(url)
    return TOTPSetupResponse(secret=secret, otpauth_url=url, qr_png_base64=qr)


@router.post("/2fa/confirm-setup", response_model=UserPublic)  # первый валидный код → 2FA on
def totp_confirm_setup(
    body: TOTPConfirmRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    if user.totp_enabled:
        return user
    if not user.totp_secret:
        raise HTTPException(status_code=400, detail="Run POST /auth/2fa/setup first")
    if not totp_service.verify(user.totp_secret, body.code):
        raise HTTPException(status_code=400, detail="Invalid authenticator code")
    return user_crud.enable_totp(db, user)


@router.post("/2fa/disable", response_model=UserPublic)  # пароль + код → 2FA off
def totp_disable(
    body: TOTPDisableRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    if not user.totp_enabled or not user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA is not enabled")
    if not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password",
        )
    if not totp_service.verify(user.totp_secret, body.totp_code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid 2FA code",
        )
    return user_crud.disable_totp(db, user)
