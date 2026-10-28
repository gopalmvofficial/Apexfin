import os
from pydantic import BaseModel

class TierLimits(BaseModel):
    name: str
    price_monthly: float
    max_transactions: int
    max_daily_transfer: float
    max_forecast_days: int
    pdf_export_allowed: bool = True
    csv_import_allowed: bool = True
    p2p_payouts_allowed: bool = True

TIER_CONFIG = {
    "free": {
        "name": "Free Starter",
        "price_monthly": 0.0,
        "max_transactions": 150,
        "max_daily_transfer": 500.0,
        "max_forecast_days": 30,
        "pdf_export_allowed": False,
        "csv_import_allowed": True,
        "p2p_payouts_allowed": True,
    },
    "pro": {
        "name": "Professional Tier",
        "price_monthly": 19.0,
        "max_transactions": 15000,
        "max_daily_transfer": 5000.0,
        "max_forecast_days": 180,
        "pdf_export_allowed": True,
        "csv_import_allowed": True,
        "p2p_payouts_allowed": True,
    },
    "enterprise": {
        "name": "Enterprise Scale",
        "price_monthly": 49.0,
        "max_transactions": 1000000,
        "max_daily_transfer": 50000.0,
        "max_forecast_days": 365,
        "pdf_export_allowed": True,
        "csv_import_allowed": True,
        "p2p_payouts_allowed": True,
    },
}

SECRET_KEY = os.getenv("JWT_SECRET", "apexfin-super-secure-production-jwt-key-2026-xyz789")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

DATA_DIR = os.path.join(os.getcwd(), "data")
os.makedirs(DATA_DIR, exist_ok=True)
DB_PATH = os.path.join(DATA_DIR, "apexfin_enterprise.db")
