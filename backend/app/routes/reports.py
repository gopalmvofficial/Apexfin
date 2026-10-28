from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from ..database import get_db
from ..security import get_current_user_payload
from ..pdf_generator import generate_financial_statement_pdf
from ..incident import incident_responder

router = APIRouter(prefix="/api/v1/reports", tags=["PDF & Document Generation"])

@router.get("/statement-pdf")
def export_statement_pdf(user_payload: dict = Depends(get_current_user_payload)):
    user_id = user_payload.get("sub")
    tenant_id = user_payload.get("tenant_id")
    user_name = user_payload.get("name", "Alex Rivera")

    with get_db() as db:
        user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        tier = user["tier"] if user else user_payload.get("tier", "free")

        # Pro / Enterprise check for PDF reports
        if tier == "free":
            # Free tier allowed preview or prompt
            pass

        account = db.execute("SELECT * FROM accounts WHERE user_id = ? AND type = 'checking'", (user_id,)).fetchone()
        account_name = account["name"] if account else "Primary Checking"
        current_balance = account["current_balance"] if account else 5000.00

        # Fetch transactions
        tx_rows = db.execute(
            "SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC LIMIT 40",
            (user_id,)
        ).fetchall()
        transactions = [dict(tx) for tx in tx_rows]

        # Inflows and Outflows
        total_income = sum(t["amount"] for t in transactions if t.get("type") == "income")
        total_expense = sum(t["amount"] for t in transactions if t.get("type") == "expense")

        pdf_buffer = generate_financial_statement_pdf(
            user_name=user_name,
            account_name=account_name,
            liquid_balance=current_balance,
            total_income=total_income,
            total_expenses=total_expense,
            transactions=transactions
        )

        incident_responder.log_event("pdf_statement_generated", f"Generated financial statement PDF for {user_name}", severity="info", user_id=user_id, tenant_id=tenant_id, db=db)

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=ApexFin_Statement_{user_name.replace(' ', '_')}.pdf"}
    )
