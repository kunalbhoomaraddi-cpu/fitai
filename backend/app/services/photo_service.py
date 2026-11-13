"""Progress photo processing. Every upload is decoded and re-encoded server-side:
- rotated upright from the camera's orientation tag, then ALL metadata (EXIF, GPS location) dropped
- resized to max 1600 px (full) and 480 px (thumbnail), saved as JPEG
- anything that isn't a real image is rejected."""
import io
from datetime import date, timedelta

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import WeightRecord

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
MAX_PHOTOS_PER_USER = 300
FULL_PX, THUMB_PX = 1600, 480
POSES = ("front", "side", "back")
Image.MAX_IMAGE_PIXELS = 60_000_000  # refuse decompression bombs


def _encode(img: Image.Image, max_px: int, quality: int) -> bytes:
    im = img.copy()
    im.thumbnail((max_px, max_px), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=quality, optimize=True, progressive=True)  # no exif= → metadata dropped
    return buf.getvalue()


def process(raw: bytes) -> dict:
    if not raw:
        raise HTTPException(400, "The file is empty.")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "That photo is too large (max 15 MB).")
    try:
        with Image.open(io.BytesIO(raw)) as probe:
            probe.verify()
        img = Image.open(io.BytesIO(raw))
        if img.format not in ("JPEG", "PNG", "WEBP", "MPO"):
            raise HTTPException(415, "Please upload a JPG, PNG or WebP photo.")
        img = ImageOps.exif_transpose(img)
        if img.mode not in ("RGB", "L"):
            bg = Image.new("RGB", img.size, (11, 13, 12))
            rgba = img.convert("RGBA")
            bg.paste(rgba, mask=rgba.split()[-1])
            img = bg
        img = img.convert("RGB")
    except HTTPException:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, SyntaxError, ValueError):
        raise HTTPException(415, "We couldn't read that file as a photo. Try a JPG or PNG.") from None
    if min(img.size) < 120:
        raise HTTPException(400, "That photo is too small.")
    full = _encode(img, FULL_PX, 84)
    thumb = _encode(img, THUMB_PX, 78)
    w, h = Image.open(io.BytesIO(full)).size
    return {"image": full, "thumb": thumb, "width": w, "height": h, "size_bytes": len(full)}


def nearest_weight(db: Session, user_id: int, d: date) -> float | None:
    rows = list(db.scalars(select(WeightRecord).where(WeightRecord.user_id == user_id,
                                                      WeightRecord.recorded_on >= d - timedelta(days=3),
                                                      WeightRecord.recorded_on <= d + timedelta(days=3))))
    if not rows:
        return None
    return round(min(rows, key=lambda r: (abs((r.recorded_on - d).days), -r.id)).weight_kg, 1)
