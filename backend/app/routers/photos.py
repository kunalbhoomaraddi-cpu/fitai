from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session, undefer

from app.database import get_db
from app.models import ProgressPhoto, User
from app.services import photo_service as svc
from app.services.auth_service import require_profile

router = APIRouter(prefix="/photos", tags=["photos"])


def _out(p: ProgressPhoto) -> dict:
    return {"id": p.id, "taken_on": p.taken_on.isoformat(), "pose": p.pose, "note": p.note, "weight_kg": p.weight_kg,
            "width": p.width, "height": p.height, "size_bytes": p.size_bytes, "created_at": p.created_at.isoformat() + "Z"}


def _own(db: Session, user: User, pid: int, load: str | None = None) -> ProgressPhoto:
    q = select(ProgressPhoto).where(ProgressPhoto.id == pid, ProgressPhoto.user_id == user.id)
    if load:
        q = q.options(undefer(getattr(ProgressPhoto, load)))
    p = db.scalar(q)
    if p is None:
        raise HTTPException(404, "Photo not found")
    return p


@router.get("")
def list_photos(user: User = Depends(require_profile), db: Session = Depends(get_db)):
    rows = db.scalars(select(ProgressPhoto).where(ProgressPhoto.user_id == user.id)
                      .order_by(ProgressPhoto.taken_on.desc(), ProgressPhoto.id.desc()))
    return [_out(p) for p in rows]


@router.post("", status_code=201)
async def upload(file: UploadFile = File(...), pose: str = Form("front"), taken_on: date | None = Form(None),
                 note: str | None = Form(None), user: User = Depends(require_profile), db: Session = Depends(get_db)):
    if user.is_demo:
        raise HTTPException(403, "Photos are turned off on the shared demo account. Create your own account to upload private photos.")
    if pose not in svc.POSES:
        raise HTTPException(422, "Pose must be front, side or back.")
    d = taken_on or date.today()
    if d > date.today() or d.year < 2000:
        raise HTTPException(422, "Choose a date that isn't in the future.")
    count = db.scalar(select(func.count()).select_from(ProgressPhoto).where(ProgressPhoto.user_id == user.id))
    if count >= svc.MAX_PHOTOS_PER_USER:
        raise HTTPException(409, f"You've reached {svc.MAX_PHOTOS_PER_USER} photos. Delete some older ones to add more.")
    raw = await file.read(svc.MAX_UPLOAD_BYTES + 1)
    data = svc.process(raw)
    p = ProgressPhoto(user_id=user.id, taken_on=d, pose=pose, note=(note or "").strip()[:200] or None,
                      weight_kg=svc.nearest_weight(db, user.id, d), **data)
    db.add(p)
    db.commit()
    return _out(p)


@router.get("/{pid}/image")
def image(pid: int, size: str = Query("full", pattern="^(full|thumb)$"), user: User = Depends(require_profile),
          db: Session = Depends(get_db)):
    """Only the owner can load a photo (requires their login token)."""
    p = _own(db, user, pid, "thumb" if size == "thumb" else "image")
    body = p.thumb if size == "thumb" else p.image
    return Response(body, media_type="image/jpeg",
                    headers={"Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff"})


class PhotoUpdate(BaseModel):
    pose: str | None = None
    note: str | None = Field(default=None, max_length=200)


@router.patch("/{pid}")
def update(pid: int, body: PhotoUpdate, user: User = Depends(require_profile), db: Session = Depends(get_db)):
    p = _own(db, user, pid)
    if body.pose is not None:
        if body.pose not in svc.POSES:
            raise HTTPException(422, "Pose must be front, side or back.")
        p.pose = body.pose
    if "note" in body.model_fields_set:
        p.note = (body.note or "").strip()[:200] or None
    db.commit()
    return _out(p)


@router.delete("/{pid}", status_code=204)
def delete(pid: int, user: User = Depends(require_profile), db: Session = Depends(get_db)):
    db.delete(_own(db, user, pid))
    db.commit()
