from __future__ import annotations

import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class EventType(str, enum.Enum):
    EMPTY_NOZZLE = "empty_nozzle"
    UNDROPPED_BAG = "undropped_bag"
    NORMAL_DROP = "normal_drop"


class PackerConfig(Base):
    __tablename__ = "packer_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    spout_count: Mapped[int] = mapped_column(Integer, nullable=False, default=8)
    rpm: Mapped[float] = mapped_column(Float, nullable=False, default=5.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    events: Mapped[list[NozzleEvent]] = relationship("NozzleEvent", back_populates="packer")


class NozzleEvent(Base):
    __tablename__ = "nozzle_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    packer_id: Mapped[int] = mapped_column(ForeignKey("packer_configs.id"), nullable=False)
    spout_number: Mapped[int] = mapped_column(Integer, nullable=False)
    event_type: Mapped[EventType] = mapped_column(Enum(EventType), nullable=False)
    frame_id: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    packer: Mapped[PackerConfig] = relationship("PackerConfig", back_populates="events")
