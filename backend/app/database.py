import sqlite3
import os
import json
from contextlib import contextmanager
from typing import Generator
from .config import DB_PATH

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Enable WAL mode and foreign keys for high-performance concurrent writes
    cursor.execute("PRAGMA journal_mode = WAL;")
    cursor.execute("PRAGMA foreign_keys = ON;")

    # 1. Tenants Table (Multi-tenant isolation)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        plan TEXT NOT NULL DEFAULT 'free',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        tier TEXT NOT NULL DEFAULT 'free',
        security_pin_hash TEXT,
        safety_buffer REAL NOT NULL DEFAULT 1500.0,
        currency TEXT NOT NULL DEFAULT 'USD',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 3. Accounts Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        current_balance REAL NOT NULL DEFAULT 0.0,
        currency TEXT NOT NULL DEFAULT 'USD',
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 4. Categories Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        color_hex TEXT NOT NULL,
        icon_name TEXT NOT NULL,
        is_essential INTEGER NOT NULL DEFAULT 1,
        default_budget REAL NOT NULL DEFAULT 0.0
    );
    """)

    # 5. Transactions Table (Optimized for thousands of records)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        category_id TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'cleared',
        tags TEXT DEFAULT '[]',
        is_recurring INTEGER DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tx_tenant_date ON transactions(tenant_id, date DESC);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id);")

    # 6. Recurring Commitments Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS recurring_payments (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        category_id TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL,
        frequency TEXT NOT NULL,
        due_day INTEGER NOT NULL,
        next_due_date TEXT NOT NULL,
        autopay INTEGER NOT NULL DEFAULT 1,
        is_active INTEGER NOT NULL DEFAULT 1,
        notes TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 7. Payment Transfers & Payouts Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS payment_transfers (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        sender_user_id TEXT NOT NULL REFERENCES users(id),
        recipient_identifier TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        note TEXT,
        status TEXT NOT NULL DEFAULT 'completed',
        idempotency_key TEXT UNIQUE NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 8. Subscription History & Billing Audits
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id),
        plan TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        current_period_start TEXT NOT NULL,
        current_period_end TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 9. Incident & Security Audit Log
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        user_id TEXT,
        event_type TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'info',
        details TEXT NOT NULL,
        ip_address TEXT,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 10. OAuth Social Identities (Google, Apple, GitHub, Microsoft)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS oauth_identities (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        provider_user_id TEXT NOT NULL,
        provider_email TEXT,
        avatar_url TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(provider, provider_user_id)
    );
    """)

    # 11. Passkey & WebAuthn Biometric Credentials (Touch ID, Face ID, Windows Hello)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS passkey_credentials (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        credential_id TEXT UNIQUE NOT NULL,
        public_key TEXT NOT NULL,
        sign_count INTEGER NOT NULL DEFAULT 0,
        device_name TEXT NOT NULL DEFAULT 'Biometric Key',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 12. Payment Orders (PayPal & Stripe atomic checkout ledger)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS payment_orders (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        order_id TEXT UNIQUE NOT NULL,
        provider TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        target_tier TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        idempotency_key TEXT UNIQUE NOT NULL,
        payer_email TEXT,
        raw_response TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);")

    # 13. Billing Invoices (Recurring SaaS invoices with proration & PDF links)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS billing_invoices (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invoice_number TEXT UNIQUE NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        status TEXT NOT NULL DEFAULT 'PAID',
        billing_reason TEXT NOT NULL,
        payment_provider TEXT NOT NULL,
        provider_payment_id TEXT,
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        subtotal REAL NOT NULL,
        tax REAL NOT NULL DEFAULT 0.0,
        proration_credit REAL NOT NULL DEFAULT 0.0,
        paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        pdf_url TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_invoices_user ON billing_invoices(user_id, created_at DESC);")

    conn.commit()
    conn.close()

@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    conn = sqlite3.connect(DB_PATH, timeout=15.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def seed_user_starter_finances(db, tenant_id: str, user_id: str, user_name: str, currency: str = "USD", tier: str = "free"):
    import uuid
    import datetime

    # 1. Accounts
    chk_id = f"acc_chk_{uuid.uuid4().hex[:8]}"
    sav_id = f"acc_sav_{uuid.uuid4().hex[:8]}"
    crd_id = f"acc_crd_{uuid.uuid4().hex[:8]}"

    existing_acc = db.execute("SELECT id FROM accounts WHERE user_id = ?", (user_id,)).fetchall()
    if not existing_acc:
        db.execute(
            "INSERT INTO accounts (id, tenant_id, user_id, name, type, current_balance, currency) VALUES (?, ?, ?, 'Primary Checking', 'checking', 5420.50, ?)",
            (chk_id, tenant_id, user_id, currency)
        )
        db.execute(
            "INSERT INTO accounts (id, tenant_id, user_id, name, type, current_balance, currency) VALUES (?, ?, ?, 'High Yield Vault', 'savings', 14850.00, ?)",
            (sav_id, tenant_id, user_id, currency)
        )
        db.execute(
            "INSERT INTO accounts (id, tenant_id, user_id, name, type, current_balance, currency) VALUES (?, ?, ?, 'Corporate Visa Card', 'credit', -420.75, ?)",
            (crd_id, tenant_id, user_id, currency)
        )
    else:
        chk_id = existing_acc[0]["id"]
        sav_id = existing_acc[1]["id"] if len(existing_acc) > 1 else chk_id

    # 2. Categories
    categories = [
        ("cat-inc-sal", "Salary & Compensation", "income", "#10b981", "Briefcase", 1, 7500.0),
        ("cat-inc-side", "Consulting & Advisory", "income", "#059669", "Laptop", 0, 1500.0),
        ("cat-exp-rent", "Housing & Lease", "expense", "#ef4444", "Home", 1, 2100.0),
        ("cat-exp-groc", "Groceries & Provisions", "expense", "#84cc16", "ShoppingCart", 1, 650.0),
        ("cat-exp-util", "Utilities & Power", "expense", "#f59e0b", "Zap", 1, 210.0),
        ("cat-exp-net", "Fiber Internet & Cloud", "expense", "#3b82f6", "Wifi", 1, 80.0),
        ("cat-exp-sub", "SaaS & Subscriptions", "expense", "#8b5cf6", "CreditCard", 0, 150.0),
        ("cat-exp-dine", "Dining & Gastronomy", "expense", "#f97316", "Coffee", 0, 380.0),
        ("cat-exp-trans", "Transit & Mobility", "expense", "#06b6d4", "Car", 1, 220.0),
    ]
    for cid, cname, ctype, chex, cicon, cess, cbud in categories:
        cat_id = f"{cid}_{user_id[:6]}"
        db.execute(
            "INSERT OR IGNORE INTO categories (id, tenant_id, name, type, color_hex, icon_name, is_essential, default_budget) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (cat_id, tenant_id, cname, ctype, chex, cicon, cess, cbud)
        )

    # 3. Clean Realistic Initial Transactions (No placeholders)
    now = datetime.datetime.now(datetime.timezone.utc)
    d_fmt = lambda days_ago: (now - datetime.timedelta(days=days_ago)).strftime("%Y-%m-%d")

    clean_txs = [
        (3850.00, "income", f"cat-inc-sal_{user_id[:6]}", chk_id, "Principal Engineer Payroll Direct Deposit", d_fmt(2), "cleared", '["payroll","salary"]', 1),
        (2100.00, "expense", f"cat-exp-rent_{user_id[:6]}", chk_id, "Apartment Lease Monthly ACH Wire", d_fmt(4), "cleared", '["housing","rent"]', 1),
        (142.30, "expense", f"cat-exp-groc_{user_id[:6]}", chk_id, "Whole Foods Organic Provisions Restock", d_fmt(5), "cleared", '["groceries"]', 0),
        (79.99, "expense", f"cat-exp-net_{user_id[:6]}", chk_id, "Verizon Fios Gigabit Fiber Internet", d_fmt(7), "cleared", '["internet","bills"]', 1),
        (118.40, "expense", f"cat-exp-util_{user_id[:6]}", chk_id, "National Grid Gas & Electricity Service", d_fmt(10), "cleared", '["utilities"]', 1),
        (54.20, "expense", f"cat-exp-dine_{user_id[:6]}", chk_id, "Artisan Coffee Roasters & Bakery", d_fmt(11), "cleared", '["coffee"]', 0),
        (1200.00, "income", f"cat-inc-side_{user_id[:6]}", chk_id, "Technical Architecture Advisory Retainer", d_fmt(14), "cleared", '["consulting"]', 0),
        (45.00, "expense", f"cat-exp-sub_{user_id[:6]}", chk_id, "GitHub Enterprise & Cloud Tools", d_fmt(16), "cleared", '["software"]', 1),
    ]
    for amt, ttype, cat_id, acc_id, desc, dt, status, tags, is_rec in clean_txs:
        tx_id = f"tx_{uuid.uuid4().hex[:10]}"
        db.execute(
            "INSERT INTO transactions (id, tenant_id, user_id, account_id, category_id, amount, type, description, date, status, tags, is_recurring) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (tx_id, tenant_id, user_id, acc_id, cat_id, amt, ttype, desc, dt, status, tags, is_rec)
        )

    # 4. Clean Recurring Payments
    rec_items = [
        ("Employer Payroll Direct Deposit", f"cat-inc-sal_{user_id[:6]}", 3850.00, "income", "biweekly", 1, d_fmt(-10)),
        ("Apartment Lease Monthly Wire", f"cat-exp-rent_{user_id[:6]}", 2100.00, "expense", "monthly", 1, d_fmt(-5)),
        ("Gigabit Fiber Internet", f"cat-exp-net_{user_id[:6]}", 79.99, "expense", "monthly", 18, d_fmt(-12)),
        ("Municipal Gas & Electricity", f"cat-exp-util_{user_id[:6]}", 125.00, "expense", "monthly", 12, d_fmt(-8)),
        ("Cloud Software & Developer Stack", f"cat-exp-sub_{user_id[:6]}", 45.00, "expense", "monthly", 25, d_fmt(-20)),
    ]
    for rname, rcat, ramt, rtype, rfreq, rdue, rnext in rec_items:
        r_id = f"rec_{uuid.uuid4().hex[:10]}"
        db.execute(
            "INSERT INTO recurring_payments (id, tenant_id, user_id, name, category_id, amount, type, frequency, due_day, next_due_date, autopay, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)",
            (r_id, tenant_id, user_id, rname, rcat, ramt, rtype, rfreq, rdue, rnext)
        )

    # 5. Initial Billing Invoice
    inv_num = f"INV-2026-{uuid.uuid4().hex[:8].upper()}"
    plan_price = 19.0 if tier == "pro" else 49.0 if tier == "enterprise" else 0.0
    db.execute(
        "INSERT INTO billing_invoices (id, tenant_id, user_id, invoice_number, amount, currency, status, billing_reason, payment_provider, period_start, period_end, subtotal, tax, proration_credit, pdf_url) VALUES (?, ?, ?, ?, ?, ?, 'PAID', ?, 'ApexFin Automated Engine', ?, ?, ?, 0.0, 0.0, ?)",
        (
            f"inv_{uuid.uuid4().hex[:10]}",
            tenant_id,
            user_id,
            inv_num,
            plan_price,
            currency,
            f"Initial {tier.capitalize()} Plan Provisioning",
            d_fmt(1),
            d_fmt(-29),
            plan_price,
            f"/api/v1/reports/invoice/{inv_num}.pdf"
        )
    )

def seed_demo_data():
    from .security import hash_password, hash_pin
    with get_db() as db:
        alex = db.execute("SELECT id FROM users WHERE email = 'alex@apexfin.io'").fetchone()
        if not alex:
            ten_alex = "ten_alex_01"
            usr_alex = "usr_alex_01"
            db.execute("INSERT OR IGNORE INTO tenants (id, name, plan) VALUES (?, 'Alex Rivera Personal', 'pro')", (ten_alex,))
            db.execute(
                "INSERT OR IGNORE INTO users (id, tenant_id, email, password_hash, name, tier, security_pin_hash, safety_buffer, currency) VALUES (?, ?, ?, ?, ?, 'pro', ?, 2000.0, 'USD')",
                (usr_alex, ten_alex, "alex@apexfin.io", hash_password("apex1234"), "Alex Rivera", hash_pin("1234"))
            )
            seed_user_starter_finances(db, ten_alex, usr_alex, "Alex Rivera", currency="USD", tier="pro")

            # Seed Maya Chen (Enterprise Tier)
            ten_maya = "ten_maya_01"
            usr_maya = "usr_maya_01"
            db.execute("INSERT OR IGNORE INTO tenants (id, name, plan) VALUES (?, 'Chen Creative Agency', 'enterprise')", (ten_maya,))
            db.execute(
                "INSERT OR IGNORE INTO users (id, tenant_id, email, password_hash, name, tier, security_pin_hash, safety_buffer, currency) VALUES (?, ?, ?, ?, ?, 'enterprise', ?, 5000.0, 'USD')",
                (usr_maya, ten_maya, "maya@creative.studio", hash_password("maya1234"), "Maya Chen", hash_pin("1234"))
            )
            seed_user_starter_finances(db, ten_maya, usr_maya, "Maya Chen", currency="USD", tier="enterprise")

