from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field

class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    tier: str = "free"
    security_pin: Optional[str] = "1234"

class LoginRequest(BaseModel):
    email: Optional[str] = None
    identifier: Optional[str] = None
    password: str

    def get_identifier(self) -> str:
        return (self.identifier or self.email or "").strip()

class OAuthLoginRequest(BaseModel):
    provider: str = Field(..., pattern="^(google|apple|github|microsoft)$")
    provider_user_id: Optional[str] = None
    email: str
    name: Optional[str] = "Social User"
    avatar_url: Optional[str] = None

class PasskeyRegisterRequest(BaseModel):
    credential_id: str
    public_key: str
    device_name: Optional[str] = "Biometric Key"

class PasskeyLoginRequest(BaseModel):
    credential_id: str
    client_data_json: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class UserProfileResponse(BaseModel):
    id: str
    name: str
    email: str
    tier: str
    tenant_id: str
    currency: str
    safety_buffer: float

class PaymentTransferRequest(BaseModel):
    recipient_identifier: str = Field(..., description="User ID, Email, UPI ID (e.g. name@okhdfcbank), Phone, or Vendor Name")
    amount: float = Field(..., gt=0.0)
    currency: str = Field(default="USD", pattern="^(USD|EUR|GBP|INR|JPY|IDR|CAD|AUD)$")
    source_account_id: Optional[str] = None
    note: Optional[str] = "ApexFin payment transfer"
    security_pin: Optional[str] = "1234"
    idempotency_key: str = Field(..., min_length=8, description="Unique client key preventing double billing")
    transfer_method: Optional[str] = "p2p"
    upi_id: Optional[str] = None

class PaymentTransferResponse(BaseModel):
    success: bool
    transfer_id: str
    amount: float
    currency: str
    recipient: str
    status: str
    remaining_balance: float
    debit_amount_source: float
    source_currency: str
    transfer_method: str
    message: str

class GenerateQRCodeRequest(BaseModel):
    recipient_identifier: str = Field(..., description="UPI VPA (e.g. name@okhdfcbank) or ApexFin User ID / Email")
    amount: Optional[float] = Field(None, gt=0.0)
    currency: str = Field(default="INR", pattern="^(USD|EUR|GBP|INR|JPY|IDR|CAD|AUD)$")
    note: Optional[str] = "ApexFin Payment"
    recipient_name: Optional[str] = "Merchant"

class GenerateQRCodeResponse(BaseModel):
    qr_payload: str
    qr_type: str
    recipient_identifier: str
    recipient_name: str
    amount: Optional[float]
    currency: str
    note: Optional[str]
    svg_qr: str

class RecipientLookupResponse(BaseModel):
    identifier: str
    is_registered_user: bool
    is_valid_upi: bool
    name: str
    avatar_initials: str
    preferred_currency: str
    user_id: Optional[str] = None

class SubscriptionUpgradeRequest(BaseModel):
    target_tier: str = Field(..., pattern="^(free|pro|enterprise)$")
    payment_method: str = "card_test"

class SubscriptionResponse(BaseModel):
    success: bool
    new_tier: str
    price_billed: float
    active_until: str
    message: str

class TransactionCreateRequest(BaseModel):
    account_id: str
    category_id: str
    amount: float
    type: str = Field(..., pattern="^(expense|income)$")
    description: str
    date: str
    tags: List[str] = []

class CSVParseResultItem(BaseModel):
    date: str
    description: str
    amount: float
    type: str
    suggested_category: str
    confidence: float

class CSVUploadResponse(BaseModel):
    success: bool
    filename: str
    parsed_count: int
    imported_count: int
    classified_items: List[CSVParseResultItem]

# --- Billing Automation & Payment Gateway Schemas ---

class PayPalCreateOrderRequest(BaseModel):
    tier: str = Field(..., pattern="^(pro|enterprise)$")
    currency: str = Field(default="USD", pattern="^(USD|EUR|GBP|JPY|IDR|CAD|AUD)$")

class PayPalCreateOrderResponse(BaseModel):
    order_id: str
    status: str
    amount: float
    currency: str
    approval_url: str

class PayPalCaptureRequest(BaseModel):
    order_id: str
    idempotency_key: str = Field(..., min_length=8)
    payer_id: Optional[str] = "PAYER_SANDBOX_01"
    payer_email: Optional[str] = None

class StripeCreateIntentRequest(BaseModel):
    tier: str = Field(..., pattern="^(pro|enterprise)$")
    currency: str = Field(default="USD", pattern="^(USD|EUR|GBP|JPY|IDR|CAD|AUD)$")

class StripeCreateIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str
    amount: float
    currency: str

class StripeConfirmPaymentRequest(BaseModel):
    payment_intent_id: str
    idempotency_key: str = Field(..., min_length=8)
    payment_method_id: Optional[str] = "pm_card_visa"

class ProrationCalculateRequest(BaseModel):
    target_tier: str = Field(..., pattern="^(free|pro|enterprise)$")

class ProrationCalculateResponse(BaseModel):
    current_tier: str
    target_tier: str
    current_tier_monthly_price: float
    target_tier_monthly_price: float
    days_remaining_in_cycle: int
    proration_credit: float
    amount_due_today: float
    next_billing_date: str
    currency: str

class CurrencyUpdateRequest(BaseModel):
    currency: str = Field(..., pattern="^(USD|EUR|GBP|JPY|IDR|CAD|AUD)$")

class FinancialSettingsUpdateRequest(BaseModel):
    safety_buffer: Optional[float] = Field(None, ge=0.0)
    currency: Optional[str] = Field(None, pattern="^(USD|EUR|GBP|JPY|IDR|CAD|AUD)$")
    name: Optional[str] = Field(None, min_length=2, max_length=100)

class RecurringPaymentCreateRequest(BaseModel):
    name: str = Field(..., min_length=2)
    category_id: str
    amount: float = Field(..., gt=0.0)
    type: str = Field(..., pattern="^(expense|income)$")
    frequency: str = Field(..., pattern="^(daily|weekly|biweekly|monthly|quarterly|annual)$")
    due_day: int = Field(..., ge=1, le=31)
    next_due_date: str
    autopay: bool = True
    notes: Optional[str] = None

class RecurringPaymentToggleRequest(BaseModel):
    id: str
    is_active: Optional[bool] = None
    autopay: Optional[bool] = None

class BudgetUpdateRequest(BaseModel):
    category_id: str
    allocated_amount: float = Field(..., ge=0.0)
    month_year: Optional[str] = "2026-10"
