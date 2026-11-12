from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def strong(cls, v: str) -> str:
        if not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one letter and one number")
        return v

    @field_validator("full_name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    is_demo: bool
    email_verified: bool
    onboarding_complete: bool
    ai_provider_pref: str

    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
    verification: dict | None = None


class PasswordChangeIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=72)

    @field_validator("new_password")
    @classmethod
    def strong(cls, v: str) -> str:
        if not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one letter and one number")
        return v


class VerifyCodeIn(BaseModel):
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class LoginOtpIn(BaseModel):
    otp_token: str = Field(min_length=10, max_length=2000)
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class OtpTokenIn(BaseModel):
    otp_token: str = Field(min_length=10, max_length=2000)


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetTokenIn(BaseModel):
    reset_token: str = Field(min_length=10, max_length=2000)


class ResetPasswordIn(BaseModel):
    reset_token: str = Field(min_length=10, max_length=2000)
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_password: str = Field(min_length=8, max_length=72)

    @field_validator("new_password")
    @classmethod
    def strong(cls, v: str) -> str:
        if not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one letter and one number")
        return v
