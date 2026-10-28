from fastapi import APIRouter, HTTPException, Depends, Header, Query, status
import uuid
import re
import io
import urllib.parse
from typing import Optional
import qrcode
import qrcode.image.svg

from ..database import get_db
from ..schemas import (
    PaymentTransferRequest,
    PaymentTransferResponse,
    GenerateQRCodeRequest,
    GenerateQRCodeResponse,
    RecipientLookupResponse,
)
from ..security import get_current_user_payload, verify_pin
from ..config import TIER_CONFIG
from ..incident import incident_responder

router = APIRouter(prefix="/api/v1/payments", tags=["Payment Gateway & P2P Transfers"])

EXCHANGE_RATES_TO_USD = {
    "USD": 1.0,
    "EUR": 0.92,
    "GBP": 0.78,
    "INR": 83.50,
    "JPY": 152.0,
    "IDR": 15750.0,
    "CAD": 1.38,
    "AUD": 1.52,
}

def convert_currency(amount: float, from_curr: str, to_curr: str) -> float:
    from_c = (from_curr or "USD").upper()
    to_c = (to_curr or "USD").upper()
    if from_c == to_c:
        return round(amount, 2)
    from_rate = EXCHANGE_RATES_TO_USD.get(from_c, 1.0)
    to_rate = EXCHANGE_RATES_TO_USD.get(to_c, 1.0)
    amount_in_usd = amount / from_rate
    converted = amount_in_usd * to_rate
    return round(converted, 2)

@router.get("/rates")
def get_exchange_rates():
    """
    Returns current multi-currency exchange rates and supported symbols.
    """
    return {
        "base": "USD",
        "rates": EXCHANGE_RATES_TO_USD,
        "currencies": [
            {"code": "USD", "symbol": "$", "name": "US Dollar"},
            {"code": "EUR", "symbol": "€", "name": "Euro"},
            {"code": "GBP", "symbol": "£", "name": "British Pound"},
            {"code": "INR", "symbol": "₹", "name": "Indian Rupee (UPI)"},
            {"code": "JPY", "symbol": "¥", "name": "Japanese Yen"},
            {"code": "IDR", "symbol": "Rp", "name": "Indonesian Rupiah"},
            {"code": "CAD", "symbol": "CA$", "name": "Canadian Dollar"},
            {"code": "AUD", "symbol": "AU$", "name": "Australian Dollar"},
        ]
    }

@router.get("/lookup-recipient", response_model=RecipientLookupResponse)
def lookup_recipient(
    identifier: str = Query(..., min_length=2),
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    Looks up recipient by ApexFin User ID, Email, Name, or UPI VPA (Virtual Payment Address).
    """
    ident = identifier.strip()
    upi_pattern = r"^[\w\.\-_]{2,100}@[\w\.\-_]{2,64}$"
    is_upi = bool(re.match(upi_pattern, ident))

    with get_db() as db:
        user = db.execute(
            "SELECT * FROM users WHERE id = ? OR email = ? OR name LIKE ?",
            (ident, ident.lower(), ident)
        ).fetchone()

        if user:
            name_parts = user["name"].split()
            initials = "".join([p[0].upper() for p in name_parts[:2]])
            return {
                "identifier": ident,
                "is_registered_user": True,
                "is_valid_upi": is_upi,
                "name": user["name"],
                "avatar_initials": initials or "AP",
                "preferred_currency": user["currency"] or "USD",
                "user_id": user["id"],
            }

        # If not internal user, check if it's a valid UPI ID
        if is_upi:
            vpa_name = ident.split("@")[0].replace(".", " ").capitalize()
            return {
                "identifier": ident,
                "is_registered_user": False,
                "is_valid_upi": True,
                "name": f"{vpa_name} (UPI VPA)",
                "avatar_initials": ident[:2].upper(),
                "preferred_currency": "INR",
                "user_id": None,
            }

        return {
            "identifier": ident,
            "is_registered_user": False,
            "is_valid_upi": False,
            "name": ident,
            "avatar_initials": ident[:2].upper(),
            "preferred_currency": "USD",
            "user_id": None,
        }

@router.post("/generate-qr", response_model=GenerateQRCodeResponse)
def generate_payment_qr_code(
    req: GenerateQRCodeRequest,
    user_payload: dict = Depends(get_current_user_payload)
):
    """
    Generates dynamic UPI standard (upi://pay?...) and ApexFin P2P QR codes with SVG rendering.
    """
    ident = req.recipient_identifier.strip()
    is_upi = "@" in ident and not ident.endswith(".com") and not ident.endswith(".io")
    currency = req.currency.upper()

    if is_upi or currency == "INR":
        qr_type = "upi"
        params = {
            "pa": ident,
            "pn": req.recipient_name or "ApexFin Merchant",
            "cu": currency,
        }
        if req.amount:
            params["am"] = f"{req.amount:.2f}"
        if req.note:
            params["tn"] = req.note
        qr_payload = f"upi://pay?{urllib.parse.urlencode(params)}"
    else:
        qr_type = "apexfin"
        params = {
            "to": ident,
            "cu": currency,
        }
        if req.amount:
            params["am"] = f"{req.amount:.2f}"
        if req.note:
            params["memo"] = req.note
        qr_payload = f"apexfin://pay?{urllib.parse.urlencode(params)}"

    # Generate crisp vector SVG QR code
    qr = qrcode.QRCode(
        version=1,
        box_size=10,
        border=2,
        image_factory=qrcode.image.svg.SvgPathImage
    )
    qr.add_data(qr_payload)
    qr.make(fit=True)

    stream = io.BytesIO()
    img = qr.make_image()
    img.save(stream)
    svg_qr = stream.getvalue().decode("utf-8")

    return {
        "qr_payload": qr_payload,
        "qr_type": qr_type,
        "recipient_identifier": ident,
        "recipient_name": req.recipient_name or ident,
        "amount": req.amount,
        "currency": currency,
        "note": req.note,
        "svg_qr": svg_qr,
    }

@router.post("/transfer", response_model=PaymentTransferResponse)
def execute_payment_transfer(
    req: PaymentTransferRequest,
    user_payload: dict = Depends(get_current_user_payload),
    idempotency_key: Optional[str] = Header(None)
):
    user_id = user_payload.get("sub")
    tenant_id = user_payload.get("tenant_id")
    user_tier = user_payload.get("tier", "free")
    effective_idempotency = idempotency_key or req.idempotency_key
    transfer_currency = (req.currency or "USD").upper()

    with get_db() as db:
        # 1. Idempotency Check (Pillar: Zero Double-Debits)
        existing_transfer = db.execute(
            "SELECT * FROM payment_transfers WHERE idempotency_key = ?", (effective_idempotency,)
        ).fetchone()

        if existing_transfer:
            return {
                "success": True,
                "transfer_id": existing_transfer["id"],
                "amount": existing_transfer["amount"],
                "currency": existing_transfer["currency"],
                "recipient": existing_transfer["recipient_identifier"],
                "status": "completed (cached)",
                "remaining_balance": 0.0,
                "debit_amount_source": existing_transfer["amount"],
                "source_currency": existing_transfer["currency"],
                "transfer_method": "cached",
                "message": "Payment verified via Idempotency-Key. Zero duplicate charges applied."
            }

        # 2. Security PIN & User Authorization
        user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if user and user["security_pin_hash"]:
            if not verify_pin(req.security_pin or "1234", user["security_pin_hash"]):
                incident_responder.log_event("unauthorized_transfer_attempt", f"Invalid PIN for user {user['email']}", severity="warning", user_id=user_id, db=db)
                raise HTTPException(status_code=403, detail="Invalid security PIN authorization")

        # 3. Multi-Currency Tier Limit Check (Converted to USD)
        tier_limit = TIER_CONFIG.get(user_tier, TIER_CONFIG["free"])["max_daily_transfer"]
        amount_in_usd = convert_currency(req.amount, transfer_currency, "USD")
        if amount_in_usd > tier_limit:
            raise HTTPException(
                status_code=400,
                detail=f"Amount ({transfer_currency} {req.amount:,.2f} ≈ ${amount_in_usd:,.2f} USD) exceeds your {user_tier.capitalize()} daily limit (${tier_limit:,.2f} USD). Upgrade to Pro or Enterprise for higher limits."
            )

        # 4. Source Account & Multi-Currency Balance Debit Check
        source_account = None
        if req.source_account_id:
            source_account = db.execute("SELECT * FROM accounts WHERE id = ? AND user_id = ?", (req.source_account_id, user_id)).fetchone()
        if not source_account:
            source_account = db.execute("SELECT * FROM accounts WHERE user_id = ? AND type = 'checking'", (user_id,)).fetchone()

        if not source_account:
            raise HTTPException(status_code=400, detail="Primary checking account not found")

        source_currency = (source_account["currency"] or user["currency"] or "USD").upper()
        debit_amount = convert_currency(req.amount, transfer_currency, source_currency)

        if source_account["current_balance"] < debit_amount:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient funds in {source_account['name']}. Required: {source_currency} {debit_amount:,.2f} (Available: {source_currency} {source_account['current_balance']:,.2f})"
            )

        # 5. Atomic Debit & Transfer Execution
        new_balance = round(source_account["current_balance"] - debit_amount, 2)
        db.execute(
            "UPDATE accounts SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (new_balance, source_account["id"])
        )

        transfer_id = f"trf_{uuid.uuid4().hex[:12]}"
        method = req.transfer_method or ("upi" if ("@" in req.recipient_identifier and not req.recipient_identifier.endswith(".io")) else "p2p")

        db.execute(
            "INSERT INTO payment_transfers (id, tenant_id, sender_user_id, recipient_identifier, amount, currency, note, status, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?)",
            (transfer_id, tenant_id, user_id, req.recipient_identifier, req.amount, transfer_currency, req.note, effective_idempotency)
        )

        # Insert outgoing transaction in sender's ledger
        tx_id = f"tx_pay_{uuid.uuid4().hex[:8]}"
        desc = f"Payment to {req.recipient_identifier} via {method.upper()}: {req.note}"
        if transfer_currency != source_currency:
            desc += f" (Converted: {source_currency} {debit_amount:,.2f})"

        db.execute(
            "INSERT INTO transactions (id, tenant_id, user_id, account_id, category_id, amount, type, description, date, status, tags) VALUES (?, ?, ?, ?, 'cat-exp-transfer', ?, 'expense', ?, CURRENT_DATE, 'cleared', '[\"payout\", \"transfer\", \"p2p\"]')",
            (tx_id, tenant_id, user_id, source_account["id"], debit_amount, desc)
        )

        # 6. Pay From One ID to Another: If Recipient is another registered ApexFin user, atomically credit them!
        recipient_user = db.execute(
            "SELECT * FROM users WHERE id = ? OR email = ? OR name = ?",
            (req.recipient_identifier, req.recipient_identifier.lower(), req.recipient_identifier)
        ).fetchone()

        recipient_credited = False
        if recipient_user:
            rec_account = db.execute(
                "SELECT * FROM accounts WHERE user_id = ? AND type = 'checking'",
                (recipient_user["id"],)
            ).fetchone()
            if rec_account:
                rec_curr = (rec_account["currency"] or "USD").upper()
                credit_amount = convert_currency(req.amount, transfer_currency, rec_curr)

                db.execute(
                    "UPDATE accounts SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (credit_amount, rec_account["id"])
                )
                rec_tx_id = f"tx_rec_{uuid.uuid4().hex[:8]}"
                sender_name = user["name"] if user else user_payload.get("name", "ApexFin User")
                db.execute(
                    "INSERT INTO transactions (id, tenant_id, user_id, account_id, category_id, amount, type, description, date, status, tags) VALUES (?, ?, ?, ?, 'cat-inc-sal', ?, 'income', ?, CURRENT_DATE, 'cleared', '[\"p2p\", \"received\"]')",
                    (rec_tx_id, recipient_user["tenant_id"], recipient_user["id"], rec_account["id"], credit_amount, f"Received from {sender_name}: {req.note}")
                )
                recipient_credited = True

        incident_responder.log_event(
            "payment_transfer_completed",
            f"Transferred {transfer_currency} {req.amount:,.2f} to {req.recipient_identifier} via {method.upper()}" + (" [Instant Account Credit]" if recipient_credited else ""),
            severity="info",
            user_id=user_id,
            tenant_id=tenant_id,
            db=db
        )

    return {
        "success": True,
        "transfer_id": transfer_id,
        "amount": req.amount,
        "currency": transfer_currency,
        "recipient": req.recipient_identifier,
        "status": "completed",
        "remaining_balance": new_balance,
        "debit_amount_source": debit_amount,
        "source_currency": source_currency,
        "transfer_method": method,
        "message": f"Successfully sent {transfer_currency} {req.amount:,.2f} to {req.recipient_identifier}." + (f" Debited {source_currency} {debit_amount:,.2f}." if source_currency != transfer_currency else "")
    }

@router.get("/history")
def get_transfer_history(user_payload: dict = Depends(get_current_user_payload)):
    user_id = user_payload.get("sub")
    with get_db() as db:
        transfers = db.execute(
            "SELECT * FROM payment_transfers WHERE sender_user_id = ? ORDER BY created_at DESC LIMIT 50",
            (user_id,)
        ).fetchall()
        return [dict(t) for t in transfers]
