"""Lightweight observability hooks for migration monitoring.

Provides timing, metrics collection, and event logging for:
- Migration duration
- Rollback events
- Schema switch failures
- Auth failures
- Cross-tenant access attempts

Metrics can be exported to Prometheus/CloudWatch later.
"""

import logging
import time
from dataclasses import dataclass, asdict
from typing import Dict, Optional

from django.utils import timezone

logger = logging.getLogger(__name__)


@dataclass
class MigrationEvent:
    """Single migration event record."""
    event_type: str  # "migration_start", "migration_complete", "validation_pass", "rollback", etc.
    school_id: int
    schema_name: Optional[str] = None
    tenant_id: Optional[str] = None
    duration_ms: Optional[int] = None
    status: Optional[str] = None  # "success", "failure", "partial"
    error: Optional[str] = None
    metadata: Dict = None
    timestamp: str = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = timezone.now().isoformat()
        if self.metadata is None:
            self.metadata = {}
    
    def to_dict(self):
        return asdict(self)


class MigrationObserver:
    """Observability tracker for migrations."""
    
    def __init__(self):
        self.events = []
        self.start_times = {}
    
    def record_event(self, event: MigrationEvent) -> None:
        """Record a single event."""
        self.events.append(event)
        logger.info(f"Migration event: {event.event_type} school={event.school_id} status={event.status}")
    
    def start_timer(self, key: str) -> None:
        """Start a named timer."""
        self.start_times[key] = time.time()
    
    def end_timer(self, key: str) -> int:
        """End named timer and return elapsed milliseconds."""
        if key not in self.start_times:
            return 0
        elapsed = time.time() - self.start_times.pop(key)
        return int(elapsed * 1000)
    
    def record_migration_start(self, school_id: int, schema_name: str, tenant_id: str = None) -> None:
        event = MigrationEvent(
            event_type="migration_start",
            school_id=school_id,
            schema_name=schema_name,
            tenant_id=tenant_id,
        )
        self.record_event(event)
        self.start_timer(f"migration_{school_id}")
    
    def record_migration_complete(self, school_id: int, schema_name: str, status: str, error: str = None, table_count: int = 0) -> None:
        duration_ms = self.end_timer(f"migration_{school_id}")
        event = MigrationEvent(
            event_type="migration_complete",
            school_id=school_id,
            schema_name=schema_name,
            duration_ms=duration_ms,
            status=status,
            error=error,
            metadata={"tables_migrated": table_count},
        )
        self.record_event(event)
    
    def record_validation_start(self, school_id: int, schema_name: str) -> None:
        self.start_timer(f"validation_{school_id}")
        event = MigrationEvent(
            event_type="validation_start",
            school_id=school_id,
            schema_name=schema_name,
        )
        self.record_event(event)
    
    def record_validation_complete(self, school_id: int, schema_name: str, status: str, tables_checked: int = 0) -> None:
        duration_ms = self.end_timer(f"validation_{school_id}")
        event = MigrationEvent(
            event_type="validation_complete",
            school_id=school_id,
            schema_name=schema_name,
            duration_ms=duration_ms,
            status=status,
            metadata={"tables_checked": tables_checked},
        )
        self.record_event(event)
    
    def record_rollback_start(self, school_id: int, schema_name: str) -> None:
        self.start_timer(f"rollback_{school_id}")
        event = MigrationEvent(
            event_type="rollback_start",
            school_id=school_id,
            schema_name=schema_name,
        )
        self.record_event(event)
    
    def record_rollback_complete(self, school_id: int, schema_name: str, status: str, tables_cleaned: int = 0) -> None:
        duration_ms = self.end_timer(f"rollback_{school_id}")
        event = MigrationEvent(
            event_type="rollback_complete",
            school_id=school_id,
            schema_name=schema_name,
            duration_ms=duration_ms,
            status=status,
            metadata={"tables_cleaned": tables_cleaned},
        )
        self.record_event(event)
    
    def record_auth_failure(self, school_id: int, reason: str) -> None:
        event = MigrationEvent(
            event_type="auth_failure",
            school_id=school_id,
            status="failure",
            error=reason,
        )
        self.record_event(event)
    
    def record_cross_tenant_access_attempt(self, source_tenant_id: str, target_tenant_id: str, resource: str) -> None:
        event = MigrationEvent(
            event_type="cross_tenant_access_attempt",
            school_id=-1,  # N/A
            tenant_id=source_tenant_id,
            status="blocked",
            error="cross_tenant_access_blocked",
            metadata={
                "source_tenant": source_tenant_id,
                "target_tenant": target_tenant_id,
                "resource": resource,
            },
        )
        self.record_event(event)
    
    def get_events(self, event_type: str = None, school_id: int = None) -> list:
        """Retrieve recorded events, optionally filtered."""
        events = self.events
        if event_type:
            events = [e for e in events if e.event_type == event_type]
        if school_id is not None:
            events = [e for e in events if e.school_id == school_id]
        return events
    
    def get_summary(self) -> Dict:
        """Get high-level summary of recorded events."""
        event_counts = {}
        total_duration_ms = 0
        error_count = 0
        
        for event in self.events:
            event_counts[event.event_type] = event_counts.get(event.event_type, 0) + 1
            if event.duration_ms:
                total_duration_ms += event.duration_ms
            if event.error:
                error_count += 1
        
        return {
            "total_events": len(self.events),
            "event_types": event_counts,
            "total_duration_ms": total_duration_ms,
            "error_count": error_count,
            "timestamp": timezone.now().isoformat(),
        }


# Global observer instance
_observer = None


def get_observer() -> MigrationObserver:
    """Get or create global observer."""
    global _observer
    if _observer is None:
        _observer = MigrationObserver()
    return _observer


def reset_observer() -> None:
    """Reset global observer (useful for test cleanup)."""
    global _observer
    _observer = None
