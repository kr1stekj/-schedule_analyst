"""Тела запросов и ответов эндпоинтов /api/auth/* (валидация Pydantic)."""
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    totp_enabled: bool


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    totp_code: Optional[str] = Field(
        default=None,
        description="Если у аккаунта включён 2FA, можно передать сразу (один запрос).",
    )


class LoginResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: str = "bearer"
    requires_2fa: bool = False
    challenge_token: Optional[str] = None


class Complete2FARequest(BaseModel):
    challenge_token: str
    totp_code: str = Field(min_length=6, max_length=8)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TOTPSetupResponse(BaseModel):
    secret: str
    otpauth_url: str
    qr_png_base64: str


class TOTPConfirmRequest(BaseModel):
    code: str = Field(min_length=6, max_length=8)


class TOTPDisableRequest(BaseModel):
    password: str
    totp_code: str = Field(min_length=6, max_length=8)
