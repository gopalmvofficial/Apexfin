import re
from typing import Tuple

CATEGORY_RULES = {
    "cat-exp-groc": {
        "name": "Groceries & Household",
        "keywords": ["whole foods", "trader joe", "safeway", "walmart", "kroger", "aldi", "market", "grocery", "target", "costco", "supermarket"]
    },
    "cat-exp-dine": {
        "name": "Dining & Coffee",
        "keywords": ["starbucks", "blue bottle", "bistro", "cafe", "restaurant", "uber eats", "doordash", "chipotle", "shake shack", "coffee", "pizza", "burger", "grill"]
    },
    "cat-exp-rent": {
        "name": "Housing & Rent",
        "keywords": ["apartment", "lease", "mortgage", "rent", "landlord", "realty", "hoa fee"]
    },
    "cat-exp-util": {
        "name": "Utilities & Power",
        "keywords": ["national grid", "pg&e", "coned", "electricity", "water", "gas service", "utility", "sewer", "power"]
    },
    "cat-exp-net": {
        "name": "Internet & Fiber",
        "keywords": ["verizon", "comcast", "xfinity", "at&t", "spectrum", "fiber", "broadband", "t-mobile"]
    },
    "cat-exp-trans": {
        "name": "Transport & Fuel",
        "keywords": ["shell", "chevron", "exxon", "uber", "lyft", "tesla", "supercharger", "transit", "subway", "metro", "gas station", "parking"]
    },
    "cat-exp-sub": {
        "name": "Subscriptions & Software",
        "keywords": ["netflix", "spotify", "aws", "github", "vercel", "openai", "apple.com/bill", "google storage", "adobe", "youtube", "dropbox", "hulu", "disney+"]
    },
    "cat-exp-ins": {
        "name": "Insurance & Healthcare",
        "keywords": ["kaiser", "geico", "state farm", "anthem", "aetna", "healthcare", "dental", "pharmacy", "cvs", "walgreens"]
    },
    "cat-inc-sal": {
        "name": "Salary & Wages",
        "keywords": ["payroll", "direct deposit", "salary", "employer", "wages", "adp", "gusto", "workday"]
    },
}

def classify_transaction_text(description: str, amount: float) -> Tuple[str, str, float]:
    desc_clean = description.lower()

    # If incoming positive or payroll keyword
    if any(k in desc_clean for k in CATEGORY_RULES["cat-inc-sal"]["keywords"]) or amount > 2500 and "deposit" in desc_clean:
        return "cat-inc-sal", CATEGORY_RULES["cat-inc-sal"]["name"], 0.95

    # Check expenses
    for cat_id, info in CATEGORY_RULES.items():
        for kw in info["keywords"]:
            if kw in desc_clean:
                return cat_id, info["name"], 0.88

    # Default fallback
    if amount < 50:
        return "cat-exp-dine", "Dining & Coffee", 0.50
    return "cat-exp-groc", "Groceries & Household", 0.50
