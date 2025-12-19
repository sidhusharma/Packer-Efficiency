from __future__ import annotations

from datetime import datetime, timedelta
from typing import Iterable

from .models import EventType, NozzleEvent, PackerConfig


class EfficiencyCalculator:
    def __init__(self, *, window_minutes: int = 60):
        self.window_minutes = window_minutes

    def _filter_window(self, events: Iterable[NozzleEvent]) -> list[NozzleEvent]:
        cutoff = datetime.utcnow() - timedelta(minutes=self.window_minutes)
        return [event for event in events if event.created_at >= cutoff]

    def calculate(self, packer: PackerConfig, events: Iterable[NozzleEvent]):
        scoped_events = self._filter_window(events)
        total_events = len(scoped_events)

        empty_nozzles = sum(1 for e in scoped_events if e.event_type == EventType.EMPTY_NOZZLE)
        undropped_bags = sum(1 for e in scoped_events if e.event_type == EventType.UNDROPPED_BAG)
        normal_drops = sum(1 for e in scoped_events if e.event_type == EventType.NORMAL_DROP)

        if total_events == 0:
            return {
                "total_events": 0,
                "empty_nozzles": 0,
                "undropped_bags": 0,
                "normal_drops": 0,
                "availability_ratio": 0.0,
                "efficiency_score": 0.0,
                "throughput_bags_per_minute": 0.0,
                "description": "No events within the selected window.",
            }

        total_loss = empty_nozzles + undropped_bags
        availability_ratio = max(0.0, 1 - (total_loss / max(total_events, 1)))

        cycles_per_minute = packer.rpm * packer.spout_count
        throughput_bags_per_minute = max(0.0, cycles_per_minute * availability_ratio)

        efficiency_score = round(availability_ratio * 100, 2)
        description = (
            f"{efficiency_score}% availability based on {total_events} spout passes "
            f"(empty: {empty_nozzles}, undropped: {undropped_bags})."
        )

        return {
            "total_events": total_events,
            "empty_nozzles": empty_nozzles,
            "undropped_bags": undropped_bags,
            "normal_drops": normal_drops,
            "availability_ratio": availability_ratio,
            "efficiency_score": efficiency_score,
            "throughput_bags_per_minute": throughput_bags_per_minute,
            "description": description,
        }
