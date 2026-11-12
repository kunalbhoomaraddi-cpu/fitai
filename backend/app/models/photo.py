from datetime import date

from sqlalchemy import Date, Float, ForeignKey, Integer, LargeBinary, String
from sqlalchemy.orm import Mapped, deferred, mapped_column

from app.database import Base
from app.models._mixins import TimestampMixin


class ProgressPhoto(TimestampMixin, Base):
    """A private progress photo. Images are re-encoded JPEGs with all metadata (EXIF, GPS) removed,
    stored in the database so they move with it (works the same on SQLite, Neon and any host)."""
    __tablename__ = "progress_photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    taken_on: Mapped[date] = mapped_column(Date, index=True)
    pose: Mapped[str] = mapped_column(String(10))  # front | side | back
    note: Mapped[str | None] = mapped_column(String(200), nullable=True)
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)  # nearest weigh-in, for context
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    size_bytes: Mapped[int] = mapped_column(Integer)
    image: Mapped[bytes] = deferred(mapped_column(LargeBinary))   # max 1600 px
    thumb: Mapped[bytes] = deferred(mapped_column(LargeBinary))   # max 480 px
