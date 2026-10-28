from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
import csv
import io
import uuid
import datetime
from typing import List
from ..database import get_db
from ..security import get_current_user_payload
from ..classification import classify_transaction_text
from ..schemas import CSVUploadResponse, CSVParseResultItem
from ..incident import incident_responder

router = APIRouter(prefix="/api/v1/upload", tags=["File Upload & Transaction Classification"])

@router.post("/csv", response_model=CSVUploadResponse)
async def upload_and_classify_csv(
    file: UploadFile = File(...),
    user_payload: dict = Depends(get_current_user_payload)
):
    user_id = user_payload.get("sub")
    tenant_id = user_payload.get("tenant_id")

    if not file.filename.endswith((".csv", ".txt")):
        raise HTTPException(status_code=400, detail="Only CSV statement files are supported")

    content = await file.read()
    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = content.decode("latin-1")

    reader = csv.reader(io.StringIO(decoded))
    rows = list(reader)

    if len(rows) < 2:
        raise HTTPException(status_code=400, detail="CSV file is empty or missing headers")

    header = [h.strip().lower() for h in rows[0]]
    # Detect column indices
    date_idx = next((i for i, h in enumerate(header) if "date" in h), 0)
    desc_idx = next((i for i, h in enumerate(header) if "desc" in h or "payee" in h or "name" in h), 1)
    amt_idx = next((i for i, h in enumerate(header) if "amount" in h or "total" in h or "debit" in h), 2)

    classified_results: List[CSVParseResultItem] = []
    imported_count = 0

    with get_db() as db:
        # Get user primary account
        account = db.execute("SELECT id FROM accounts WHERE user_id = ? AND type = 'checking'", (user_id,)).fetchone()
        account_id = account["id"] if account else f"acc_{user_id[:6]}"

        for row in rows[1:]:
            if len(row) <= max(date_idx, desc_idx, amt_idx):
                continue

            raw_date = row[date_idx].strip()
            raw_desc = row[desc_idx].strip()
            raw_amt_str = row[amt_idx].strip().replace("$", "").replace(",", "")

            try:
                raw_amt = float(raw_amt_str)
            except ValueError:
                continue

            tx_type = "income" if raw_amt < 0 or "deposit" in raw_desc.lower() or "payroll" in raw_desc.lower() else "expense"
            abs_amt = abs(raw_amt)

            # Format date to YYYY-MM-DD
            formatted_date = datetime.date.today().isoformat()
            if "/" in raw_date:
                parts = raw_date.split("/")
                if len(parts) == 3:
                    m, d, y = parts
                    if len(y) == 2:
                        y = f"20{y}"
                    formatted_date = f"{y.zfill(4)}-{m.zfill(2)}-{d.zfill(2)}"
            elif "-" in raw_date:
                formatted_date = raw_date

            cat_id, cat_name, confidence = classify_transaction_text(raw_desc, abs_amt)

            item = CSVParseResultItem(
                date=formatted_date,
                description=raw_desc,
                amount=abs_amt,
                type=tx_type,
                suggested_category=cat_name,
                confidence=confidence
            )
            classified_results.append(item)

            # Insert into database
            tx_id = f"tx_csv_{uuid.uuid4().hex[:10]}"
            db.execute(
                "INSERT INTO transactions (id, tenant_id, user_id, account_id, category_id, amount, type, description, date, status, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'cleared', '[\"csv_import\"]')",
                (tx_id, tenant_id, user_id, account_id, cat_id, abs_amt, tx_type, raw_desc, formatted_date)
            )
            imported_count += 1

        incident_responder.log_event("csv_statement_imported", f"Imported {imported_count} transactions from {file.filename}", severity="info", user_id=user_id, tenant_id=tenant_id, db=db)

    return {
        "success": True,
        "filename": file.filename,
        "parsed_count": len(classified_results),
        "imported_count": imported_count,
        "classified_items": classified_results
    }
