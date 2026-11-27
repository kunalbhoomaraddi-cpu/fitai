from sqlalchemy import Boolean, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models._mixins import TimestampMixin


class BuddyLink(TimestampMixin, Base):
    """Two people who agreed to be workout buddies. Stored once per pair, smaller user id first.
    Buddies only ever see each other's first name, workout days this week and streak."""
    __tablename__ = "buddy_links"
    __table_args__ = (UniqueConstraint("user_a_id", "user_b_id", name="uq_buddy_pair"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_a_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    user_b_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)


class BuddyNudge(TimestampMixin, Base):
    """A friendly "time to train" from one buddy to another (at most one per pair per day)."""
    __tablename__ = "buddy_nudges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    from_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    to_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    seen: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
