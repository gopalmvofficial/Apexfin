import unittest
import asyncio
import os
import sys
import httpx
import uuid

if os.name == "nt":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from backend.app.main import app
from backend.app.database import init_db, seed_demo_data, get_db

class TestApexFinBackendAsync(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        init_db()
        seed_demo_data()
        with get_db() as db:
            db.execute("UPDATE users SET tier = 'pro' WHERE email = 'alex@apexfin.io'")
        self.transport = httpx.ASGITransport(app=app)
        self.client = httpx.AsyncClient(transport=self.transport, base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_health_check(self):
        res = await self.client.get("/api/v1/system/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "healthy")
        self.assertIn("uptime_seconds", data)

    async def test_auth_login_and_me(self):
        # Test login with pre-seeded demo account
        login_res = await self.client.post("/api/v1/auth/login", json={
            "email": "alex@apexfin.io",
            "password": "apex1234"
        })
        self.assertEqual(login_res.status_code, 200)
        token_data = login_res.json()
        token = token_data["access_token"]
        self.assertTrue(len(token) > 20)

        # Query /me with Bearer token
        me_res = await self.client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me_res.status_code, 200)
        me_data = me_res.json()
        self.assertEqual(me_data["email"], "alex@apexfin.io")
        self.assertEqual(me_data["tier"], "pro")

    async def test_payment_transfer_and_idempotency(self):
        # Login
        login_res = await self.client.post("/api/v1/auth/login", json={
            "email": "alex@apexfin.io",
            "password": "apex1234"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        idempotency_key = "idemp_test_unique_998877"
        transfer_payload = {
            "recipient_identifier": "maya@creative.studio",
            "amount": 150.0,
            "note": "Subcontractor UX design review",
            "security_pin": "1234",
            "idempotency_key": idempotency_key
        }

        # 1st attempt: Should succeed
        res1 = await self.client.post("/api/v1/payments/transfer", json=transfer_payload, headers=headers)
        self.assertEqual(res1.status_code, 200)
        data1 = res1.json()
        self.assertTrue(data1["success"])
        self.assertEqual(data1["amount"], 150.0)

        # 2nd attempt with IDENTICAL idempotency key: Should return cached response without double debiting!
        res2 = await self.client.post("/api/v1/payments/transfer", json=transfer_payload, headers=headers)
        self.assertEqual(res2.status_code, 200)
        data2 = res2.json()
        self.assertTrue(data2["success"])
        self.assertIn("Idempotency-Key", data2["message"])

    async def test_subscription_upgrade(self):
        login_res = await self.client.post("/api/v1/auth/login", json={
            "email": "alex@apexfin.io",
            "password": "apex1234"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        res = await self.client.post("/api/v1/billing/subscribe", json={
            "target_tier": "enterprise"
        }, headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["new_tier"], "enterprise")

    async def test_pdf_statement_generation(self):
        login_res = await self.client.post("/api/v1/auth/login", json={
            "email": "alex@apexfin.io",
            "password": "apex1234"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        res = await self.client.get("/api/v1/reports/statement-pdf", headers=headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers["content-type"], "application/pdf")
        # Verify valid PDF magic header bytes
        self.assertTrue(res.content.startswith(b"%PDF-"))

    async def test_auth_login_with_username_or_name(self):
        # Login using username/name 'Alex Rivera' instead of email
        login_res = await self.client.post("/api/v1/auth/login", json={
            "identifier": "Alex Rivera",
            "password": "apex1234"
        })
        self.assertEqual(login_res.status_code, 200)
        data = login_res.json()
        self.assertEqual(data["user"]["name"], "Alex Rivera")
        self.assertEqual(data["user"]["email"], "alex@apexfin.io")

    async def test_oauth_social_login(self):
        # 1. Test Google Social Sign-In
        google_res = await self.client.post("/api/v1/auth/oauth", json={
            "provider": "google",
            "email": "jordan.dev@gmail.com",
            "name": "Jordan Dev",
            "avatar_url": "https://lh3.googleusercontent.com/a/dummy"
        })
        self.assertEqual(google_res.status_code, 200)
        g_data = google_res.json()
        self.assertEqual(g_data["user"]["email"], "jordan.dev@gmail.com")
        self.assertEqual(g_data["user"]["provider"], "google")

        # 2. Test Sign in with Apple
        apple_res = await self.client.post("/api/v1/auth/oauth", json={
            "provider": "apple",
            "email": "sarah.apple@icloud.com",
            "name": "Sarah Connor",
            "provider_user_id": "001290.apple.sub.id"
        })
        self.assertEqual(apple_res.status_code, 200)
        a_data = apple_res.json()
        self.assertEqual(a_data["user"]["email"], "sarah.apple@icloud.com")
        self.assertEqual(a_data["user"]["provider"], "apple")

    async def test_passkey_biometric_flow(self):
        # Login first to get token
        login_res = await self.client.post("/api/v1/auth/login", json={
            "email": "alex@apexfin.io",
            "password": "apex1234"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Register hardware passkey
        cred_id = f"passkey_apple_faceid_{uuid.uuid4().hex[:8]}"
        reg_res = await self.client.post("/api/v1/auth/passkey/register", json={
            "credential_id": cred_id,
            "public_key": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...",
            "device_name": "MacBook Pro Touch ID & Face ID"
        }, headers=headers)
        self.assertEqual(reg_res.status_code, 200)

        # 1-click Biometric Passkey Login
        pk_login_res = await self.client.post("/api/v1/auth/passkey/login", json={
            "credential_id": cred_id
        })
        self.assertEqual(pk_login_res.status_code, 200)
        pk_data = pk_login_res.json()
        self.assertEqual(pk_data["user"]["email"], "alex@apexfin.io")
        self.assertEqual(pk_data["user"]["auth_method"], "passkey_biometric")

    async def test_paypal_create_and_capture_order(self):
        login_res = await self.client.post("/api/v1/auth/login", json={
            "email": "alex@apexfin.io",
            "password": "apex1234"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Create PayPal Order
        create_res = await self.client.post("/api/v1/billing/paypal/create-order", json={
            "tier": "enterprise",
            "currency": "USD"
        }, headers=headers)
        self.assertEqual(create_res.status_code, 200)
        create_data = create_res.json()
        self.assertEqual(create_data["status"], "CREATED")
        order_id = create_data["order_id"]
        self.assertTrue(order_id.startswith("PAYID_"))

        # 2. Capture PayPal Order
        capture_res = await self.client.post("/api/v1/billing/paypal/capture-order", json={
            "order_id": order_id,
            "idempotency_key": f"idemp_cap_{uuid.uuid4().hex[:10]}",
            "payer_email": "alex.payer@paypal.com"
        }, headers=headers)
        self.assertEqual(capture_res.status_code, 200)
        cap_data = capture_res.json()
        self.assertEqual(cap_data["status"], "COMPLETED")
        self.assertEqual(cap_data["new_tier"], "enterprise")
        self.assertTrue("INV-PAYPAL-" in cap_data["invoice_number"])

        # 3. Duplicate capture with same order_id returns ALREADY_PROCESSED
        dup_res = await self.client.post("/api/v1/billing/paypal/capture-order", json={
            "order_id": order_id,
            "idempotency_key": f"idemp_cap_dup_{uuid.uuid4().hex[:10]}"
        }, headers=headers)
        self.assertEqual(dup_res.status_code, 200)
        self.assertEqual(dup_res.json()["status"], "ALREADY_PROCESSED")

    async def test_stripe_create_intent_and_confirm(self):
        login_res = await self.client.post("/api/v1/auth/login", json={
            "email": "alex@apexfin.io",
            "password": "apex1234"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Create Intent
        intent_res = await self.client.post("/api/v1/billing/stripe/create-intent", json={
            "tier": "pro",
            "currency": "USD"
        }, headers=headers)
        self.assertEqual(intent_res.status_code, 200)
        intent_data = intent_res.json()
        pi_id = intent_data["payment_intent_id"]
        self.assertTrue(pi_id.startswith("pi_"))
        self.assertTrue("_secret_" in intent_data["client_secret"])

        # 2. Confirm Payment
        confirm_res = await self.client.post("/api/v1/billing/stripe/confirm-payment", json={
            "payment_intent_id": pi_id,
            "idempotency_key": f"idemp_str_{uuid.uuid4().hex[:10]}"
        }, headers=headers)
        self.assertEqual(confirm_res.status_code, 200)
        conf_data = confirm_res.json()
        self.assertEqual(conf_data["status"], "COMPLETED")
        self.assertEqual(conf_data["new_tier"], "pro")

    async def test_proration_and_subscription_status(self):
        login_res = await self.client.post("/api/v1/auth/login", json={
            "email": "alex@apexfin.io",
            "password": "apex1234"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Calculate proration from Pro to Enterprise
        pro_res = await self.client.post("/api/v1/billing/calculate-proration", json={
            "target_tier": "enterprise"
        }, headers=headers)
        self.assertEqual(pro_res.status_code, 200)
        pro_data = pro_res.json()
        self.assertEqual(pro_data["target_tier"], "enterprise")
        self.assertTrue(pro_data["amount_due_today"] >= 0)

        # Subscription status
        status_res = await self.client.get("/api/v1/billing/subscription-status", headers=headers)
        self.assertEqual(status_res.status_code, 200)
        status_data = status_res.json()
        self.assertEqual(status_data["status"], "active")

    async def test_currency_selection_and_persistence(self):
        login_res = await self.client.post("/api/v1/auth/login", json={
            "email": "alex@apexfin.io",
            "password": "apex1234"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Switch to EUR
        curr_res = await self.client.patch("/api/v1/financials/currency", json={
            "currency": "EUR"
        }, headers=headers)
        self.assertEqual(curr_res.status_code, 200)
        self.assertEqual(curr_res.json()["currency"], "EUR")

        # Verify persisted in metrics
        metrics_res = await self.client.get("/api/v1/financials/metrics", headers=headers)
        self.assertEqual(metrics_res.status_code, 200)
        self.assertEqual(metrics_res.json()["currency"], "EUR")

        # Switch to GBP
        curr_res2 = await self.client.patch("/api/v1/financials/currency", json={
            "currency": "GBP"
        }, headers=headers)
        self.assertEqual(curr_res2.status_code, 200)
        self.assertEqual(curr_res2.json()["currency"], "GBP")

    async def test_clean_user_registration_starter_finances(self):
        new_email = f"user_{uuid.uuid4().hex[:8]}@apexfin.io"
        reg_res = await self.client.post("/api/v1/auth/register", json={
            "name": "Jordan Smith",
            "email": new_email,
            "password": "strongPassword123!",
            "tier": "free"
        })
        self.assertEqual(reg_res.status_code, 200)
        token = reg_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Verify new user has clean accounts
        acc_res = await self.client.get("/api/v1/financials/accounts", headers=headers)
        self.assertEqual(acc_res.status_code, 200)
        accounts = acc_res.json()
        self.assertTrue(len(accounts) >= 2)

        # Verify clean transactions seeded with real amounts
        tx_res = await self.client.get("/api/v1/financials/transactions", headers=headers)
        self.assertEqual(tx_res.status_code, 200)
        tx_data = tx_res.json()
        self.assertTrue(tx_data["total_count"] >= 5)
        # Ensure descriptions are real clean non-placeholder strings
        first_desc = tx_data["transactions"][0]["description"]
        self.assertFalse("TODO" in first_desc)
        self.assertFalse("mock" in first_desc.lower())

        # Verify initial invoice was created
        inv_res = await self.client.get("/api/v1/billing/invoices", headers=headers)
        self.assertEqual(inv_res.status_code, 200)
        invoices = inv_res.json()
        self.assertTrue(len(invoices) >= 1)

    async def test_multi_currency_transfer_and_id_to_id_credit(self):
        # 1. Login as Alex Rivera
        login_alex = await self.client.post("/api/v1/auth/login", json={
            "email": "alex@apexfin.io",
            "password": "apex1234"
        })
        token_alex = login_alex.json()["access_token"]
        headers_alex = {"Authorization": f"Bearer {token_alex}"}

        # Set Alex and Maya accounts to USD for baseline conversion check
        with get_db() as db:
            db.execute("UPDATE accounts SET currency = 'USD' WHERE user_id = 'usr_alex_01'")
            db.execute("UPDATE users SET currency = 'USD' WHERE id = 'usr_alex_01'")
            maya_acc_before = db.execute("SELECT current_balance FROM accounts WHERE user_id = 'usr_maya_01' AND type = 'checking'").fetchone()
            bal_before = maya_acc_before["current_balance"]

        # Transfer 8350.00 INR (equivalent to 100 USD) directly to Maya's User ID 'usr_maya_01'
        transfer_payload = {
            "recipient_identifier": "usr_maya_01",
            "amount": 8350.00,
            "currency": "INR",
            "note": "Cross-border INR design retainer via User ID",
            "security_pin": "1234",
            "idempotency_key": f"idemp_id2id_{uuid.uuid4().hex[:10]}",
            "transfer_method": "p2p"
        }
        res = await self.client.post("/api/v1/payments/transfer", json=transfer_payload, headers=headers_alex)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["currency"], "INR")
        # 8350 INR at 83.50 INR/USD should debit ~100 USD
        self.assertEqual(data["debit_amount_source"], 100.00)
        self.assertEqual(data["source_currency"], "USD")

        # Verify Maya's account balance was automatically credited
        with get_db() as db:
            maya_acc_after = db.execute("SELECT current_balance FROM accounts WHERE user_id = 'usr_maya_01' AND type = 'checking'").fetchone()
            bal_after = maya_acc_after["current_balance"]
            self.assertEqual(round(bal_after - bal_before, 2), 100.00)

    async def test_upi_transfer_and_qr_code_generation(self):
        login_res = await self.client.post("/api/v1/auth/login", json={
            "email": "alex@apexfin.io",
            "password": "apex1234"
        })
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Test UPI VPA Transfer
        upi_payload = {
            "recipient_identifier": "roedy@okhdfcbank",
            "amount": 2500.00,
            "currency": "INR",
            "note": "Software license settlement",
            "security_pin": "1234",
            "idempotency_key": f"idemp_upi_{uuid.uuid4().hex[:10]}",
            "transfer_method": "upi",
            "upi_id": "roedy@okhdfcbank"
        }
        upi_res = await self.client.post("/api/v1/payments/transfer", json=upi_payload, headers=headers)
        self.assertEqual(upi_res.status_code, 200)
        upi_data = upi_res.json()
        self.assertTrue(upi_data["success"])
        self.assertEqual(upi_data["transfer_method"], "upi")
        self.assertEqual(upi_data["currency"], "INR")

        # 2. Test Dynamic UPI QR Code Generation
        qr_payload = {
            "recipient_identifier": "merchant@okhdfcbank",
            "amount": 1499.00,
            "currency": "INR",
            "note": "ApexFin Cloud Invoice",
            "recipient_name": "ApexFin Technologies"
        }
        qr_res = await self.client.post("/api/v1/payments/generate-qr", json=qr_payload, headers=headers)
        self.assertEqual(qr_res.status_code, 200)
        qr_data = qr_res.json()
        self.assertEqual(qr_data["qr_type"], "upi")
        self.assertTrue(qr_data["qr_payload"].startswith("upi://pay?"))
        self.assertIn("pa=merchant%40okhdfcbank", qr_data["qr_payload"])
        # Verify SVG QR markup
        self.assertTrue("<svg" in qr_data["svg_qr"])
        self.assertTrue("</svg>" in qr_data["svg_qr"])

        # 3. Test Recipient Lookup for UPI
        lookup_res = await self.client.get("/api/v1/payments/lookup-recipient?identifier=alex@icici", headers=headers)
        self.assertEqual(lookup_res.status_code, 200)
        lookup_data = lookup_res.json()
        self.assertTrue(lookup_data["is_valid_upi"])
        self.assertEqual(lookup_data["preferred_currency"], "INR")

if __name__ == "__main__":
    unittest.main()
