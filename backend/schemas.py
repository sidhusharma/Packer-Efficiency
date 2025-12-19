from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from .models import EventType


class PackerConfigCreate(BaseModel):
    name: str
    spout_count: int = Field(ge=1)
    rpm: float = Field(gt=0)


class PackerConfigRead(PackerConfigCreate):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


class NozzleEventCreate(BaseModel):
    packer_id: int
    spout_number: int
    event_type: EventType
    frame_id: Optional[str] = None


class NozzleEventRead(NozzleEventCreate):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


class EfficiencyMetrics(BaseModel):
    total_events: int
    empty_nozzles: int
    undropped_bags: int
    normal_drops: int
    availability_ratio: float
    efficiency_score: float
    throughput_bags_per_minute: float
    description: str
