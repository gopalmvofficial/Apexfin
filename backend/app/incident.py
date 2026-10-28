import time
import os
import sqlite3
from typing import Dict, Any, List
from .database import get_db

class IncidentResponder:
    def __init__(self):
        self.start_time = time.time()
        self.circuit_breaker_open = False
        self.error_count = 0

    def get_uptime_seconds(self) -> float:
        return time.time() - self.start_time

    def log_event(self, event_type: str, details: str, severity: str = "info", user_id: str = None, tenant_id: str = None, ip_address: str = None, db: sqlite3.Connection = None):
        try:
            event_id = f"evt_{int(time.time() * 1000)}_{os.urandom(2).hex()}"
            if db:
                db.execute(
                    "INSERT INTO audit_logs (id, tenant_id, user_id, event_type, severity, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (event_id, tenant_id, user_id, event_type, severity, details, ip_address or "127.0.0.1")
                )
            else:
                with get_db() as conn:
                    conn.execute(
                        "INSERT INTO audit_logs (id, tenant_id, user_id, event_type, severity, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (event_id, tenant_id, user_id, event_type, severity, details, ip_address or "127.0.0.1")
                    )
        except Exception as e:
            print(f"Failed to record audit log: {e}")

    def get_system_health(self) -> Dict[str, Any]:
        with get_db() as db:
            tx_count = db.execute("SELECT COUNT(*) as count FROM transactions").fetchone()["count"]
            users_count = db.execute("SELECT COUNT(*) as count FROM users").fetchone()["count"]
            transfers_count = db.execute("SELECT COUNT(*) as count FROM payment_transfers").fetchone()["count"]

        return {
            "status": "healthy" if not self.circuit_breaker_open else "degraded",
            "uptime_seconds": round(self.get_uptime_seconds(), 2),
            "circuit_breaker": "closed",
            "total_transactions": tx_count,
            "total_registered_users": users_count,
            "total_p2p_transfers": transfers_count,
            "database": "sqlite_wal_active",
            "version": "1.0.0-enterprise"
        }

incident_responder = IncidentResponder()
