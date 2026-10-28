from fastapi import APIRouter, HTTPException, Depends, Query, status
from typing import Optional, List
import uuid
from ..database import get_db
from ..security import get_current_user_payload
from ..schemas import (
    TransactionCreateRequest,
    CurrencyUpdateRequest,
    FinancialSettingsUpdateRequest,
    RecurringPaymentCreateRequest,
    RecurringPaymentToggleRequest,
    BudgetUpdateRequest,
)
from ..incident import incident_responder

router = APIRouter(prefix="/api/v1/financials", tags=["Financials & Multi-Tenant Ledger"])

@router.get("/metrics")
def get_user_metrics(user_payload: dict = Depends(get_current_user_payload)):
    user_id = user_payload.get("sub")
    with get_db() as db:
        accounts = db.execute("SELECT * FROM accounts WHERE user_id = ?", (user_id,)).fetchall()
        user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()

        liquid = sum(a["current_balance"] for a in accounts if a["type"] in ("checking", "savings"))
        net_worth = sum(a["current_balance"] for a in accounts)

        recurring = db.execute("SELECT * FROM recurring_payments WHERE user_id = ? AND is_active = 1", (user_id,)).fetchall()
        monthly_inc = sum(r["amount"] for r in recurring if r["type"] == "income")
        monthly_exp = sum(r["amount"] for r in recurring if r["type"] == "expense")
        est_burn = 1275.00
        net_savings = monthly_inc - monthly_exp - est_burn

        return {
            "net_worth": round(net_worth, 2),
            "liquid_balance": round(liquid, 2),
            "monthly_income": round(monthly_inc, 2),
            "monthly_fixed_expenses": round(monthly_exp, 2),
            "monthly_variable_estimated": round(est_burn, 2),
            "monthly_net_savings": round(net_savings, 2),
            "savings_rate_pct": round((net_savings / monthly_inc * 100), 1) if monthly_inc > 0 else 0.0,
            "safety_buffer": user["safety_buffer"] if user else 1500.0,
            "currency": user["currency"] if user else "USD",
            "tier": user["tier"] if user else "free"
        }

@router.get("/accounts")
def get_user_accounts(user_payload: dict = Depends(get_current_user_payload)):
    user_id = user_payload.get("sub")
    with get_db() as db:
        accounts = db.execute("SELECT * FROM accounts WHERE user_id = ?", (user_id,)).fetchall()
        return [dict(a) for a in accounts]

@router.get("/categories")
def get_user_categories(user_payload: dict = Depends(get_current_user_payload)):
    tenant_id = user_payload.get("tenant_id")
    with get_db() as db:
        cats = db.execute("SELECT * FROM categories WHERE tenant_id = ?", (tenant_id,)).fetchall()
        return [dict(c) for c in cats]

@router.patch("/currency")
def update_user_currency(
    req: CurrencyUpdateRequest,
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    Updates the preferred display and transaction currency for the user and accounts.
    Persists immediately to database.
    """
    user_id = user_payload.get("sub")
    tenant_id = user_payload.get("tenant_id")
    new_curr = req.currency.upper()

    with get_db() as db:
        db.execute("UPDATE users SET currency = ? WHERE id = ?", (new_curr, user_id))
        db.execute("UPDATE accounts SET currency = ? WHERE user_id = ?", (new_curr, user_id))
        incident_responder.log_event("currency_changed", f"User currency updated to {new_curr}", severity="info", user_id=user_id, tenant_id=tenant_id, db=db)

    return {
        "success": True,
        "currency": new_curr,
        "message": f"Currency updated to {new_curr}. All financial metrics and horizons are dynamically formatted."
    }

@router.patch("/settings")
def update_financial_settings(
    req: FinancialSettingsUpdateRequest,
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    Updates financial guardrails (safety buffer, currency, user display name).
    """
    user_id = user_payload.get("sub")
    tenant_id = user_payload.get("tenant_id")

    with get_db() as db:
        user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        updates = []
        params = []
        if req.safety_buffer is not None:
            updates.append("safety_buffer = ?")
            params.append(req.safety_buffer)
        if req.currency is not None:
            updates.append("currency = ?")
            params.append(req.currency.upper())
            db.execute("UPDATE accounts SET currency = ? WHERE user_id = ?", (req.currency.upper(), user_id))
        if req.name is not None:
            updates.append("name = ?")
            params.append(req.name.strip())

        if updates:
            params.append(user_id)
            db.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = ?", tuple(params))
            incident_responder.log_event("settings_updated", f"Settings updated for {user_id}", severity="info", user_id=user_id, tenant_id=tenant_id, db=db)

        updated_user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return {
            "success": True,
            "safety_buffer": updated_user["safety_buffer"],
            "currency": updated_user["currency"],
            "name": updated_user["name"],
            "message": "Financial guardrails saved successfully."
        }

@router.get("/transactions")
def get_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    type: Optional[str] = None,
    user_payload: dict = Depends(get_current_user_payload)
):
    user_id = user_payload.get("sub")
    tenant_id = user_payload.get("tenant_id")

    with get_db() as db:
        query = "SELECT * FROM transactions WHERE tenant_id = ?"
        params = [tenant_id]

        if search:
            query += " AND description LIKE ?"
            params.append(f"%{search}%")
        if type:
            query += " AND type = ?"
            params.append(type)

        query += " ORDER BY date DESC LIMIT ? OFFSET ?"
        params.extend([limit, (page - 1) * limit])

        txs = db.execute(query, tuple(params)).fetchall()
        total = db.execute("SELECT COUNT(*) as count FROM transactions WHERE tenant_id = ?", (tenant_id,)).fetchone()["count"]

        return {
            "transactions": [dict(t) for t in txs],
            "total_count": total,
            "page": page,
            "limit": limit
        }

@router.post("/transactions")
def create_transaction(req: TransactionCreateRequest, user_payload: dict = Depends(get_current_user_payload)):
    user_id = user_payload.get("sub")
    tenant_id = user_payload.get("tenant_id")

    with get_db() as db:
        tx_id = f"tx_{uuid.uuid4().hex[:10]}"
        db.execute(
            "INSERT INTO transactions (id, tenant_id, user_id, account_id, category_id, amount, type, description, date, status, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'cleared', '[]')",
            (tx_id, tenant_id, user_id, req.account_id, req.category_id, req.amount, req.type, req.description, req.date)
        )

        # Update account balance
        if req.type == "income":
            db.execute("UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?", (req.amount, req.account_id))
        else:
            db.execute("UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?", (req.amount, req.account_id))

    return {"success": True, "transaction_id": tx_id}

@router.delete("/transactions/{transaction_id}")
def delete_transaction(transaction_id: str, user_payload: dict = Depends(get_current_user_payload)):
    user_id = user_payload.get("sub")
    tenant_id = user_payload.get("tenant_id")

    with get_db() as db:
        tx = db.execute("SELECT * FROM transactions WHERE id = ? AND tenant_id = ?", (transaction_id, tenant_id)).fetchone()
        if not tx:
            raise HTTPException(status_code=404, detail="Transaction not found")

        # Reverse balance change
        if tx["type"] == "income":
            db.execute("UPDATE accounts SET current_balance = current_balance - ? WHERE id = ?", (tx["amount"], tx["account_id"]))
        else:
            db.execute("UPDATE accounts SET current_balance = current_balance + ? WHERE id = ?", (tx["amount"], tx["account_id"]))

        db.execute("DELETE FROM transactions WHERE id = ?", (transaction_id,))

    return {"success": True, "message": "Transaction deleted and balance adjusted"}

# --- Recurring Obligations Endpoints ---

@router.get("/recurring")
def get_recurring_payments(user_payload: dict = Depends(get_current_user_payload)):
    user_id = user_payload.get("sub")
    with get_db() as db:
        items = db.execute("SELECT * FROM recurring_payments WHERE user_id = ? ORDER BY due_day ASC", (user_id,)).fetchall()
        return [dict(i) for i in items]

@router.post("/recurring")
def create_recurring_payment(
    req: RecurringPaymentCreateRequest,
    user_payload: dict = Depends(get_current_user_payload)
):
    user_id = user_payload.get("sub")
    tenant_id = user_payload.get("tenant_id")
    r_id = f"rec_{uuid.uuid4().hex[:10]}"

    with get_db() as db:
        db.execute(
            "INSERT INTO recurring_payments (id, tenant_id, user_id, name, category_id, amount, type, frequency, due_day, next_due_date, autopay, is_active, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)",
            (r_id, tenant_id, user_id, req.name, req.category_id, req.amount, req.type, req.frequency, req.due_day, req.next_due_date, 1 if req.autopay else 0, req.notes)
        )

    return {"success": True, "recurring_id": r_id}

@router.patch("/recurring/{item_id}")
def toggle_recurring_payment(
    item_id: str,
    req: RecurringPaymentToggleRequest,
    user_payload: dict = Depends(get_current_user_payload)
):
    user_id = user_payload.get("sub")
    with get_db() as db:
        item = db.execute("SELECT * FROM recurring_payments WHERE id = ? AND user_id = ?", (item_id, user_id)).fetchone()
        if not item:
            raise HTTPException(status_code=404, detail="Recurring commitment not found")

        updates = []
        params = []
        if req.is_active is not None:
            updates.append("is_active = ?")
            params.append(1 if req.is_active else 0)
        if req.autopay is not None:
            updates.append("autopay = ?")
            params.append(1 if req.autopay else 0)

        if updates:
            params.append(item_id)
            db.execute(f"UPDATE recurring_payments SET {', '.join(updates)} WHERE id = ?", tuple(params))

    return {"success": True, "id": item_id}

@router.delete("/recurring/{item_id}")
def delete_recurring_payment(item_id: str, user_payload: dict = Depends(get_current_user_payload)):
    user_id = user_payload.get("sub")
    with get_db() as db:
        db.execute("DELETE FROM recurring_payments WHERE id = ? AND user_id = ?", (item_id, user_id))
    return {"success": True, "id": item_id}

# --- Budgets Endpoints ---

@router.get("/budgets")
def get_budgets(user_payload: dict = Depends(get_current_user_payload)):
    tenant_id = user_payload.get("tenant_id")
    with get_db() as db:
        cats = db.execute("SELECT * FROM categories WHERE tenant_id = ? AND type = 'expense'", (tenant_id,)).fetchall()
        budgets = []
        for c in cats:
            spent = db.execute(
                "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE tenant_id = ? AND category_id = ? AND type = 'expense'",
                (tenant_id, c["id"])
            ).fetchone()["total"]
            allocated = c["default_budget"]
            budgets.append({
                "categoryId": c["id"],
                "categoryName": c["name"],
                "colorHex": c["color_hex"],
                "iconName": c["icon_name"],
                "isEssential": bool(c["is_essential"]),
                "allocatedAmount": allocated,
                "spentAmount": spent,
                "remainingAmount": round(allocated - spent, 2),
                "utilizationPct": round((spent / allocated * 100)) if allocated > 0 else 0,
                "isOverBudget": spent > allocated
            })
        return budgets

@router.post("/budgets")
def update_budget(req: BudgetUpdateRequest, user_payload: dict = Depends(get_current_user_payload)):
    tenant_id = user_payload.get("tenant_id")
    with get_db() as db:
        db.execute("UPDATE categories SET default_budget = ? WHERE id = ? AND tenant_id = ?", (req.allocated_amount, req.category_id, tenant_id))
    return {"success": True, "category_id": req.category_id, "allocated": req.allocated_amount}
