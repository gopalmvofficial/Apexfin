from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import time

from .database import init_db, get_db, seed_demo_data
from .security import hash_password, hash_pin
from .routes import auth, payments, billing, upload, reports, system, financials
from .incident import incident_responder

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database with WAL and create tables
    init_db()
    seed_demo_data()
    yield

app = FastAPI(
    title="ApexFin Enterprise Financial Intelligence & Payout API",
    description="High-performance async FastAPI backend with multi-tenant isolation, P2P payouts, SaaS subscription state machines, ReportLab PDF generation, and CSV auto-classification.",
    version="1.0.0-enterprise",
    lifespan=lifespan
)

# CORS Middleware allowing Next.js frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gateway Logging & Latency Header Middleware
@app.middleware("http")
async def gateway_telemetry_middleware(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration_ms = (time.time() - start) * 1000
    response.headers["X-Gateway-Latency-MS"] = f"{duration_ms:.2f}"
    response.headers["X-API-Standard"] = "ApexFin-Enterprise-v1"
    return response

# Mount Sub-Routers
app.include_router(auth.router)
app.include_router(financials.router)
app.include_router(payments.router)
app.include_router(billing.router)
app.include_router(upload.router)
app.include_router(reports.router)
app.include_router(system.router)

@app.get("/")
def root():
    return {
        "service": "ApexFin Enterprise API",
        "docs_url": "/docs",
        "health": "/api/v1/system/health",
        "version": "1.0.0-enterprise"
    }
