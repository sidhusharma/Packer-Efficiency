from __future__ import annotations

import base64
import os
from io import BytesIO
from pathlib import Path
from typing import List

import numpy as np
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageDraw
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .efficiency import EfficiencyCalculator
from .models import EventType, NozzleEvent, PackerConfig
from .schemas import (
    EfficiencyMetrics,
    NozzleEventCreate,
    NozzleEventRead,
    PackerConfigCreate,
    PackerConfigRead,
)
from .yolo import YoloDetector

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Packer Efficiency Monitor", version="0.1.0")

origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

static_dir = Path(__file__).parent / "static"
static_dir.mkdir(exist_ok=True)
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

detector = YoloDetector()
calculator = EfficiencyCalculator(window_minutes=int(os.getenv("WINDOW_MINUTES", 120)))


def get_packer(db: Session, packer_id: int) -> PackerConfig:
    packer = db.query(PackerConfig).filter(PackerConfig.id == packer_id).first()
    if not packer:
        raise HTTPException(status_code=404, detail="Packer not found")
    return packer


@app.post("/api/packers", response_model=PackerConfigRead)
def create_packer(config: PackerConfigCreate, db: Session = Depends(get_db)):
    existing = db.query(PackerConfig).filter(PackerConfig.name == config.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Packer name already exists")

    packer = PackerConfig(**config.dict())
    db.add(packer)
    db.commit()
    db.refresh(packer)
    return packer


@app.get("/api/packers", response_model=List[PackerConfigRead])
def list_packers(db: Session = Depends(get_db)):
    return db.query(PackerConfig).order_by(PackerConfig.created_at.desc()).all()


@app.post("/api/events", response_model=NozzleEventRead)
def create_event(event: NozzleEventCreate, db: Session = Depends(get_db)):
    packer = get_packer(db, event.packer_id)
    if event.spout_number > packer.spout_count or event.spout_number <= 0:
        raise HTTPException(status_code=400, detail="Invalid spout number for this packer")

    record = NozzleEvent(**event.dict())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@app.get("/api/events", response_model=List[NozzleEventRead])
def list_events(packer_id: int, db: Session = Depends(get_db)):
    get_packer(db, packer_id)
    events = (
        db.query(NozzleEvent)
        .filter(NozzleEvent.packer_id == packer_id)
        .order_by(NozzleEvent.created_at.desc())
        .limit(250)
        .all()
    )
    return events


@app.get("/api/efficiency", response_model=EfficiencyMetrics)
def efficiency(packer_id: int, db: Session = Depends(get_db)):
    packer = get_packer(db, packer_id)
    events = db.query(NozzleEvent).filter(NozzleEvent.packer_id == packer.id).all()
    metrics = calculator.calculate(packer, events)
    return EfficiencyMetrics(**metrics)


def _placeholder_frame(label: str = "live") -> str:
    image = Image.new("RGB", (480, 320), color=(22, 62, 85))
    draw = ImageDraw.Draw(image)
    draw.text((20, 20), f"Camera feed: {label}", fill=(255, 255, 255))
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{encoded}"


@app.get("/api/live-frame")
def live_frame():
    height, width = detector.warmup()
    mock_frame = np.zeros((height, width, 3), dtype=np.uint8)
    result = detector.detect(mock_frame)
    overlay_label = f"YOLO: {len(result['boxes'])} boxes"
    return {"frame": _placeholder_frame(overlay_label), "detections": result}


@app.post("/api/demo-seed")
def demo_seed(db: Session = Depends(get_db)):
    if db.query(PackerConfig).count() == 0:
        eight = PackerConfig(name="8-spout packer", spout_count=8, rpm=5.0)
        sixteen = PackerConfig(name="16-spout packer", spout_count=16, rpm=2.5)
        db.add_all([eight, sixteen])
        db.commit()

    packer = db.query(PackerConfig).first()
    sample_events = [
        NozzleEvent(packer_id=packer.id, spout_number=1, event_type=EventType.NORMAL_DROP),
        NozzleEvent(packer_id=packer.id, spout_number=2, event_type=EventType.EMPTY_NOZZLE),
        NozzleEvent(packer_id=packer.id, spout_number=3, event_type=EventType.UNDROPPED_BAG),
        NozzleEvent(packer_id=packer.id, spout_number=4, event_type=EventType.NORMAL_DROP),
    ]
    db.add_all(sample_events)
    db.commit()
    return {"message": "Seeded demo data", "packer_id": packer.id}
