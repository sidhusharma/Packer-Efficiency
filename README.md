# Packer Efficiency

Full-stack reference implementation for monitoring cement roto packers. The app shows packer master data, live camera frames, efficiency KPIs, and event reporting for empty nozzles and undropped bags. The backend uses FastAPI + SQLAlchemy (ready for MySQL), and the UI is a lightweight HTML dashboard.

## Features
- Configure multiple packers (8 or 16 spouts with their RPM).
- Log events for empty nozzle (bag not placed), undropped bag (took a second round), and normal drops.
- Calculate availability, missed nozzles, and estimated throughput per minute using spout count and RPM.
- Mock YOLOv8 detector endpoint plus placeholder live frame for the camera feed.
- Demo seed endpoint to preload sample packers and events.

## Getting started

### 1) Install dependencies
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2) Configure the database
By default the app uses SQLite for a quick start. To connect to MySQL, set `DATABASE_URL`, for example:
```
export DATABASE_URL=mysql+pymysql://user:password@localhost:3306/packer_db
```

### 3) Run the backend (serves the UI)
```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```
Open http://localhost:8000 in Chrome to use the dashboard.

### 4) Seed demo data (optional)
```bash
curl -X POST http://localhost:8000/api/demo-seed
```
Then refresh the page to see packers, events, and computed efficiency.

## Project layout
```
backend/
  main.py          # FastAPI app, REST endpoints, serves static dashboard
  database.py      # SQLAlchemy engine/session (MySQL-ready)
  models.py        # ORM models for packers and nozzle events
  efficiency.py    # Availability and throughput calculation
  yolo.py          # Mock YOLOv8 wrapper
  static/          # Front-end assets (HTML, CSS, JS)
```

## Notes on YOLOv8 integration
The `backend/yolo.py` class is a stub that mimics YOLO output. Replace `detect` with calls to the Ultralytics YOLOv8 model once weights and a real camera feed are available. The `/api/live-frame` endpoint is already shaped to return detections alongside a frame preview.
