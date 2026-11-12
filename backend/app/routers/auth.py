from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.config import get_settings
from app.schemas.auth import ForgotPasswordIn, ResetPasswordIn, ResetTokenIn, LoginIn, LoginOtpIn, OtpTokenIn, RegisterIn, TokenOut, UserOut, VerifyCodeIn
from app.services import demo_service, login_otp_service, password_reset_service, verification_service
from app.services.auth_service import create_access_token, get_authenticated_user, hash_password, verify_password
from app.utils.ratelimit import auth_rate_limit

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenOut, status_code=201)
def register(body: RegisterIn, request: Request, db: Session = Depends(get_db)):
    auth_rate_limit(f"reg:{request.client.host if request.client else 'x'}")
    email = body.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    required = get_settings().email_verification_required
    user = User(email=email, full_name=body.full_name, hashed_password=hash_password(body.password),
                email_verified=not required)
    db.add(user)
    db.commit()
    verification = None
    if required:
        try:
            verification = verification_service.issue_code(db, user, enforce_cooldown=False)
        except HTTPException as e:  # account exists; user can press "resend" once email is fixed
            verification = {"delivery": "failed", "error": e.detail}
    return TokenOut(access_token=create_access_token(user.id), user=UserOut.model_validate(user), verification=verification)


@router.post("/login")
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    """Step 1: password. With LOGIN_OTP_REQUIRED, returns {otp_required, otp_token} and emails a code
    instead of a session. Unverified accounts skip this (they must verify their email first anyway)."""
    auth_rate_limit(f"login:{request.client.host if request.client else 'x'}")
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if get_settings().login_otp_required and user.email_verified and not user.is_demo:
        return login_otp_service.start(db, user)
    return TokenOut(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.post("/login/verify", response_model=TokenOut)
def login_verify(body: LoginOtpIn, request: Request, db: Session = Depends(get_db)):
    """Step 2: the 6-digit code from the login email → real session token."""
    auth_rate_limit(f"login-otp:{request.client.host if request.client else 'x'}")
    user = login_otp_service.verify(db, body.otp_token, body.code)
    return TokenOut(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.post("/login/resend")
def login_resend(body: OtpTokenIn, db: Session = Depends(get_db)):
    return login_otp_service.resend(db, body.otp_token)


@router.post("/demo", response_model=TokenOut)
def demo(db: Session = Depends(get_db)):
    """Creates (or resets) a clearly-labelled demo account populated with sample data."""
    user = demo_service.create_or_reset_demo(db)
    return TokenOut(access_token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_authenticated_user)):
    return user


@router.post("/verify-email", response_model=UserOut)
def verify_email(body: VerifyCodeIn, request: Request, user: User = Depends(get_authenticated_user),
                 db: Session = Depends(get_db)):
    auth_rate_limit(f"verify:{user.id}")
    if not user.email_verified:
        verification_service.verify_code(db, user, body.code)
    return user


@router.post("/resend-code")
def resend_code(user: User = Depends(get_authenticated_user), db: Session = Depends(get_db)):
    if user.email_verified:
        return {"delivery": "none", "detail": "Email already verified"}
    return verification_service.issue_code(db, user)


@router.post("/logout", status_code=204)
def logout(_: User = Depends(get_authenticated_user)):
    """JWTs are stateless; the client discards the token. Endpoint exists for symmetry/auditing."""
    return Response(status_code=204)


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordIn, request: Request, db: Session = Depends(get_db)):
    """Emails a reset code if the account exists; 404 if no account uses this email."""
    auth_rate_limit(f"forgot:{request.client.host if request.client else 'x'}")
    return password_reset_service.start(db, body.email)


@router.post("/forgot-password/resend")
def forgot_password_resend(body: ResetTokenIn, db: Session = Depends(get_db)):
    return password_reset_service.resend(db, body.reset_token)


@router.post("/reset-password")
def reset_password(body: ResetPasswordIn, request: Request, db: Session = Depends(get_db)):
    auth_rate_limit(f"reset:{request.client.host if request.client else 'x'}")
    password_reset_service.complete(db, body.reset_token, body.code, body.new_password)
    return {"detail": "Your password has been reset. Please log in with your new password."}
