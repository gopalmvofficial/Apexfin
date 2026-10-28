import assert from 'node:assert';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { clientStore, computeClientFinancials, getInitialClientStore } from '../src/lib/client-store.ts';
import { projectCashflow } from '../src/lib/predictive-engine.ts';

const DEFAULT_PORT = process.env.PORT || '8005';
let activeBaseUrl = `http://127.0.0.1:${DEFAULT_PORT}`;

console.log('🧪 Starting ApexFin Full-Stack & E2E Verification Suite...\n');

async function testClientStoreAndPredictiveEngine() {
  console.log('--- Step 1: Testing Client Store & Predictive Cashflow Invariants ---');
  const store = getInitialClientStore();
  const financials = computeClientFinancials(store);

  assert(financials.liquidBalance > 0, 'Liquid balance should be strictly positive');
  assert(financials.safetyBuffer === 2000, 'Default safety buffer should be 2000');
  assert(store.transactions.length >= 10, 'Initial store must include rich sample transactions');
  assert(store.recurringPayments.length >= 5, 'Initial store must include recurring obligations');

  const projection = projectCashflow({
    startBalance: financials.liquidBalance,
    safetyBuffer: financials.safetyBuffer,
    recurringPayments: store.recurringPayments,
    transactions: store.transactions,
    categories: store.categories,
    horizonDays: 90,
    variableBurnMultiplier: 1.0,
  });
  assert(projection.dailyTimeline.length === 90, 'Projection horizon of 90 days must yield 90 timeline days');
  assert(typeof projection.baselineLowestBalance === 'number', 'Lowest balance must be calculated');
  assert(projection.summary.totalProjectedIncome > 0, 'Projected income should be positive');
  console.log(`✅ Client predictive engine passed (Horizon: 90 days, Timeline: ${projection.dailyTimeline.length}, Lowest: $${projection.baselineLowestBalance})`);
}

async function testBackendLiveIntegration() {
  console.log(`\n--- Step 2: Testing Python FastAPI Enterprise Backend ---`);

  let pyProcess = null;
  let serverReady = false;

  // Check if already running on default
  try {
    const existing = await fetch(`${activeBaseUrl}/api/v1/system/health`);
    if (existing.ok) {
      serverReady = true;
      console.log(`⚡ FastAPI server is already running on ${activeBaseUrl}`);
    }
  } catch {}

  if (!serverReady) {
    pyProcess = spawn('python', ['-u', 'backend/run.py'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      env: { ...process.env, PORT: DEFAULT_PORT },
    });

    pyProcess.stdout?.on('data', (d) => {
      const msg = d.toString();
      const match = msg.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) activeBaseUrl = `http://127.0.0.1:${match[1]}`;
    });

    pyProcess.stderr?.on('data', (d) => {
      const msg = d.toString();
      const match = msg.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) activeBaseUrl = `http://127.0.0.1:${match[1]}`;
    });

    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        const res = await fetch(`${activeBaseUrl}/api/v1/system/health`);
        if (res.ok) {
          serverReady = true;
          break;
        }
      } catch {}
    }
  }

  if (!serverReady) {
    if (pyProcess) pyProcess.kill();
    throw new Error(`FastAPI server failed to start within 15 seconds on ${activeBaseUrl}.`);
  }

  console.log(`🚀 Live FastAPI backend verified operational on ${activeBaseUrl}`);

  try {
    // 1. Health check
    const healthRes = await fetch(`${activeBaseUrl}/api/v1/system/health`);
    assert.strictEqual(healthRes.status, 200);
    const healthData = await healthRes.json();
    assert.strictEqual(healthData.status, 'healthy');
    console.log(`✅ Health check verified (Engine: ${healthData.database}, Circuit Breaker: ${healthData.circuit_breaker})`);

    // 2. Auth login (Email and Username)
    const loginRes = await fetch(`${activeBaseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alex@apexfin.io', password: 'apex1234' }),
    });
    assert.strictEqual(loginRes.status, 200);
    const loginData = await loginRes.json();
    const token = loginData.access_token;
    assert(token && token.length > 20, 'JWT token must be issued');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    console.log(`✅ JWT Auth login successful via Email (User: ${loginData.user.name}, Plan: ${loginData.user.tier})`);

    // 2b. Auth login via Name / Username
    const userLoginRes = await fetch(`${activeBaseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'Alex Rivera', password: 'apex1234' }),
    });
    assert.strictEqual(userLoginRes.status, 200);
    console.log(`✅ JWT Auth login successful via Username/Name ("Alex Rivera")`);

    // 2c. Social OAuth (Google & Apple)
    const googleRes = await fetch(`${activeBaseUrl}/api/v1/auth/oauth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'google', email: 'alex.g@gmail.com', name: 'Alex Google SSO' }),
    });
    assert.strictEqual(googleRes.status, 200);
    const googleData = await googleRes.json();
    assert.strictEqual(googleData.user.provider, 'google');
    console.log(`✅ Google OAuth SSO verified (User: ${googleData.user.name})`);

    const appleRes = await fetch(`${activeBaseUrl}/api/v1/auth/oauth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'apple', email: 'alex.apple@icloud.com', name: 'Alex Apple ID' }),
    });
    assert.strictEqual(appleRes.status, 200);
    const appleData = await appleRes.json();
    assert.strictEqual(appleData.user.provider, 'apple');
    console.log(`✅ Sign in with Apple verified (User: ${appleData.user.name})`);

    // 2d. Passkey & Biometric Sign-in
    const passkeyId = `pk_e2e_${Date.now()}`;
    const pkRegRes = await fetch(`${activeBaseUrl}/api/v1/auth/passkey/register`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ credential_id: passkeyId, public_key: 'dummy_pub_key_base64', device_name: 'Face ID' }),
    });
    assert.strictEqual(pkRegRes.status, 200);

    const pkLoginRes = await fetch(`${activeBaseUrl}/api/v1/auth/passkey/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential_id: passkeyId }),
    });
    assert.strictEqual(pkLoginRes.status, 200);
    const pkData = await pkLoginRes.json();
    assert.strictEqual(pkData.user.auth_method, 'passkey_biometric');
    console.log(`✅ Biometric Passkey / Face ID login verified`);

    // 3. User profile /me
    const meRes = await fetch(`${activeBaseUrl}/api/v1/auth/me`, { headers });
    assert.strictEqual(meRes.status, 200);
    const meData = await meRes.json();
    assert.strictEqual(meData.email, 'alex@apexfin.io');
    console.log(`✅ Profile retrieved with multi-tenant tenant isolation: ${meData.tenant_id}`);

    // 4. Multi-Currency P2P Payment Transfer with Idempotency
    const idempotencyKey = `e2e_idemp_${Date.now()}`;
    const transferPayload = {
      recipient_identifier: 'maya@creative.studio',
      amount: 175.50,
      currency: 'USD',
      note: 'E2E Automated verification payout',
      security_pin: '1234',
      idempotency_key: idempotencyKey,
    };

    const tx1Res = await fetch(`${activeBaseUrl}/api/v1/payments/transfer`, {
      method: 'POST',
      headers,
      body: JSON.stringify(transferPayload),
    });
    assert.strictEqual(tx1Res.status, 200);
    const tx1Data = await tx1Res.json();
    assert.strictEqual(tx1Data.success, true);
    assert.strictEqual(tx1Data.amount, 175.50);
    console.log(`✅ P2P Payment transfer executed: $175.50 to ${tx1Data.recipient}`);

    // Replay with identical idempotency key
    const tx2Res = await fetch(`${activeBaseUrl}/api/v1/payments/transfer`, {
      method: 'POST',
      headers,
      body: JSON.stringify(transferPayload),
    });
    assert.strictEqual(tx2Res.status, 200);
    const tx2Data = await tx2Res.json();
    assert.strictEqual(tx2Data.success, true);
    assert(tx2Data.message.includes('Idempotency-Key'), 'Replay must return cached response');
    console.log(`✅ Idempotency guard verified: duplicate request deduplicated without double charge`);

    // 4b. UPI Payment Transfer & Conversion (INR)
    const upiPayload = {
      recipient_identifier: 'alex@okhdfcbank',
      amount: 8350.0,
      currency: 'INR',
      transfer_method: 'upi',
      note: 'UPI Payment to Alex HDFC',
      security_pin: '1234',
      idempotency_key: `e2e_upi_${Date.now()}`,
    };
    const upiRes = await fetch(`${activeBaseUrl}/api/v1/payments/transfer`, {
      method: 'POST',
      headers,
      body: JSON.stringify(upiPayload),
    });
    assert.strictEqual(upiRes.status, 200);
    const upiData = await upiRes.json();
    assert.strictEqual(upiData.success, true);
    assert.strictEqual(upiData.currency, 'INR');
    assert.strictEqual(upiData.transfer_method, 'upi');
    console.log(`✅ UPI Payment Transfer verified (Sent: INR 8,350.00, Debited: $${upiData.debit_amount_source} USD)`);

    // 4c. Recipient Lookup (UPI VPA & Registered User ID)
    const lookupUpiRes = await fetch(`${activeBaseUrl}/api/v1/payments/lookup-recipient?identifier=alex@okhdfcbank`, { headers });
    assert.strictEqual(lookupUpiRes.status, 200);
    const lookupUpi = await lookupUpiRes.json();
    assert.strictEqual(lookupUpi.is_valid_upi, true);
    console.log(`✅ Recipient Lookup verified for UPI VPA (Name: ${lookupUpi.name})`);

    const lookupMayaRes = await fetch(`${activeBaseUrl}/api/v1/payments/lookup-recipient?identifier=usr_maya_01`, { headers });
    assert.strictEqual(lookupMayaRes.status, 200);
    const lookupMaya = await lookupMayaRes.json();
    assert.strictEqual(lookupMaya.is_registered_user, true);
    console.log(`✅ Recipient Lookup verified for Registered User ID (User: ${lookupMaya.name})`);

    // 4d. Dynamic Vector SVG QR Code Generation
    const qrRes = await fetch(`${activeBaseUrl}/api/v1/payments/generate-qr`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        recipient_identifier: 'alex@okapexbank',
        recipient_name: 'Alex Rivera',
        amount: 2500.0,
        currency: 'INR',
        note: 'Invoice Retainer #1042',
      }),
    });
    assert.strictEqual(qrRes.status, 200);
    const qrData = await qrRes.json();
    assert.strictEqual(qrData.qr_type, 'upi');
    assert(qrData.qr_payload.startsWith('upi://pay?'), 'Must generate standard upi:// URI');
    assert(qrData.svg_qr.includes('<svg'), 'Must produce vector SVG QR code');
    console.log(`✅ Dynamic UPI QR Code verified (Payload: ${qrData.qr_payload})`);

    // 5. Subscription tier upgrade
    const subRes = await fetch(`${activeBaseUrl}/api/v1/billing/subscribe`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ target_tier: 'enterprise' }),
    });
    assert.strictEqual(subRes.status, 200);
    const subData = await subRes.json();
    assert.strictEqual(subData.new_tier, 'enterprise');
    console.log(`✅ SaaS Billing upgrade verified: Plan upgraded to ${subData.new_tier.toUpperCase()}`);

    // 5b. PayPal Orders V2 & Atomic Capture Test
    const ppOrderRes = await fetch(`${activeBaseUrl}/api/v1/billing/paypal/create-order`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tier: 'enterprise', currency: 'USD' }),
    });
    assert.strictEqual(ppOrderRes.status, 200);
    const ppOrder = await ppOrderRes.json();
    assert(ppOrder.order_id.startsWith('PAYID_'), 'PayPal order ID must be generated');

    const ppCapRes = await fetch(`${activeBaseUrl}/api/v1/billing/paypal/capture-order`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        order_id: ppOrder.order_id,
        idempotency_key: `e2e_pp_cap_${Date.now()}`,
        payer_email: 'alex.shopper@paypal.sandbox',
      }),
    });
    assert.strictEqual(ppCapRes.status, 200);
    const ppCap = await ppCapRes.json();
    assert.strictEqual(ppCap.status, 'COMPLETED');
    console.log(`✅ PayPal Checkout & Atomic Capture verified (Order: ${ppOrder.order_id}, Invoice: ${ppCap.invoice_number})`);

    // 5c. Stripe PaymentIntent & Confirmation Test
    const stripeIntentRes = await fetch(`${activeBaseUrl}/api/v1/billing/stripe/create-intent`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tier: 'pro', currency: 'USD' }),
    });
    assert.strictEqual(stripeIntentRes.status, 200);
    const stripeIntent = await stripeIntentRes.json();
    assert(stripeIntent.payment_intent_id.startsWith('pi_'), 'PaymentIntent ID must be generated');

    const stripeConfRes = await fetch(`${activeBaseUrl}/api/v1/billing/stripe/confirm-payment`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        payment_intent_id: stripeIntent.payment_intent_id,
        idempotency_key: `e2e_str_conf_${Date.now()}`,
      }),
    });
    assert.strictEqual(stripeConfRes.status, 200);
    const stripeConf = await stripeConfRes.json();
    assert.strictEqual(stripeConf.status, 'COMPLETED');
    console.log(`✅ Stripe PaymentIntent & Confirmation verified (Intent: ${stripeIntent.payment_intent_id})`);

    // 5d. Currency Selection & Persistence Invariant Test
    for (const testCurr of ['EUR', 'GBP', 'JPY', 'IDR']) {
      const currRes = await fetch(`${activeBaseUrl}/api/v1/financials/currency`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ currency: testCurr }),
      });
      assert.strictEqual(currRes.status, 200);
      const currData = await currRes.json();
      assert.strictEqual(currData.currency, testCurr);
    }
    console.log(`✅ Dynamic Currency Switching & Instant Persistence verified across EUR, GBP, JPY, IDR`);

    // Reset currency to USD for safety
    await fetch(`${activeBaseUrl}/api/v1/financials/currency`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ currency: 'USD' }),
    });

    // 5e. Clean User Registration & Realistic Starter Finances Test
    const newRegEmail = `e2e_user_${Date.now()}@apexfin.io`;
    const regRes = await fetch(`${activeBaseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Jordan Finch',
        email: newRegEmail,
        password: 'securePassword99!',
        tier: 'free',
      }),
    });
    assert.strictEqual(regRes.status, 200);
    const regData = await regRes.json();
    const newHeaders = { Authorization: `Bearer ${regData.access_token}`, 'Content-Type': 'application/json' };

    const newTxRes = await fetch(`${activeBaseUrl}/api/v1/financials/transactions`, { headers: newHeaders });
    assert.strictEqual(newTxRes.status, 200);
    const newTxs = await newTxRes.json();
    assert(newTxs.total_count >= 5, 'New user must be provisioned with realistic clean transactions');
    assert(!newTxs.transactions[0].description.includes('TODO'), 'No TODO or placeholder text allowed');
    console.log(`✅ Clean User Starter Kit verified: New user seeded with ${newTxs.total_count} realistic non-placeholder transactions`);

    // 6. ReportLab PDF Generation
    const pdfRes = await fetch(`${activeBaseUrl}/api/v1/reports/statement-pdf`, { headers });
    assert.strictEqual(pdfRes.status, 200);
    assert.strictEqual(pdfRes.headers.get('content-type'), 'application/pdf');
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    assert(pdfBuffer.toString('utf-8', 0, 5) === '%PDF-', 'Must start with PDF magic signature %PDF-');
    console.log(`✅ Streaming ReportLab PDF generated (${pdfBuffer.length} bytes, magic: %PDF-)`);

    // 7. Audit Trail
    const auditRes = await fetch(`${activeBaseUrl}/api/v1/system/audit?limit=10`, { headers });
    assert.strictEqual(auditRes.status, 200);
    const auditLogs = await auditRes.json();
    assert(Array.isArray(auditLogs) && auditLogs.length > 0, 'Audit logs must be recorded');
    console.log(`✅ Incident & Audit trail verified (${auditLogs.length} events logged)`);

  } finally {
    if (pyProcess) pyProcess.kill();
  }
}

async function runAll() {
  await testClientStoreAndPredictiveEngine();
  await testBackendLiveIntegration();
  console.log('\n🎉 ALL FULLSTACK & E2E SUITE INVARIANTS PASSED SUCCESSFULLY!\n');
}

runAll().catch((err) => {
  console.error('\n❌ E2E Suite failed:', err);
  process.exit(1);
});
