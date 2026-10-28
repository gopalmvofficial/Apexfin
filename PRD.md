# Product Requirements Document (PRD)

**Project**: ApexFin — Predictive Cashflow & Financial Intelligence Platform  
**Version**: 1.0.0  
**Status**: Approved  
**Created**: 2026-10-26  
**Last Updated**: 2026-10-26  

---

## 1. Executive Summary
ApexFin is an intelligent, privacy-first personal and small-business financial intelligence platform that tracks cashflow, categorizes expenses, aggregates recurring monthly payment obligations, and runs high-precision predictive cashflow forecasts over 30, 60, 90, and 365 days. By combining fixed monthly recurring obligations with historical variable burn rates, ApexFin predicts liquidity minimums, detects shortfall risks before they happen, and allows users to simulate dynamic "What-If" financial scenarios (e.g., taking on new loans, altering recurring payments, salary changes, or emergency expenses).

---

## 2. Problem Statement
- **Problem**: Traditional budgeting apps only offer reactive retrospectives ("Here is what you spent last month"). They fail to answer the critical forward-looking question: *"Will I have enough liquidity in checking on the 24th after rent and insurance clear, or will I overdraft?"*
- **Target Users**:
  1. Professionals and freelancers managing multiple subscription cycles, variable monthly invoices, and recurring expenses.
  2. Households balancing fixed obligations (mortgage/rent, utilities, auto loans, insurance) against discretionary lifestyle spending.
  3. Small businesses / solopreneurs tracking monthly operational runway and recurring software / vendor commitments.
- **Current Pain Points**:
  - Fragmented visibility across weekly, monthly, and annual recurring subscriptions.
  - Blindness to impending cash crunches due to clashing payment schedules.
  - Inability to experiment safely with future expenses (new lease, subscription cleanup, investment allocations).
  - Bloated, ad-heavy legacy financial tools with slow user experiences and weak predictive modeling.

---

## 3. Goals & Success Metrics
| Goal | Metric | Target |
|---|---|---|
| Comprehensive Visibility | % of recurring commitments detected and scheduled | 100% of recurring payments visible in unified calendar & ledger |
| Predictive Accuracy | Forecast cashflow variance vs. actuals over 30-day horizon | < 5% variance for scheduled obligations |
| Instant What-If Modeling | Client & server-side simulation response time | < 50ms compute latency for 365-day scenario projection |
| Operational Reliability | API and application runtime health | Zero unhandled exceptions; 100% type-safe data pipeline |
| User Interface Performance | Core Web Vitals (LCP, INP, CLS) | LCP < 1.2s, INP < 50ms, CLS = 0.00 |

---

## 4. User Personas
### Persona 1: Alex Rivera (Mid-Career Software Architect)
- **Role**: Senior Engineer & Active Investor.
- **Goals**: Monitor 18+ active recurring subscriptions, plan quarterly tax disbursements, and ensure savings targets are met without manual spreadsheet bookkeeping.
- **Frustrations**: Standard bank apps don't project cashflow curves past the current statement date.
- **Key Behaviors**: Checks monthly commitments weekly; runs what-if tests before major purchases.

### Persona 2: Maya Chen (Digital Agency Solopreneur)
- **Role**: Creative Agency Founder.
- **Goals**: Anticipate net cash balances 60–90 days out to decide contractor hiring and equipment purchases.
- **Frustrations**: Variable client payouts clash with fixed SaaS and payroll dates, leading to surprise cash pinches.
- **Key Behaviors**: Uses forecast curve to pinpoint lowest projected cash balance point each month.

---

## 5. Feature Requirements

### MVP Features (Must Have — v1.0)
- [x] **Financial Dashboard & Metric KPIs**: Total current net liquidity, monthly income, monthly fixed obligations, monthly variable burn, and projected end-of-month balance.
- [x] **Transaction Ledger & Categorization**: Full CRUD operations for historical and current income/expense items with category filtering, search, sorting, and tag support.
- [x] **Recurring Monthly Payments & Subscriptions Manager**:
  - Manage recurring obligations (Rent, Netflix, Health Insurance, Utilities, Gym, Internet, etc.).
  - Fields: Name, Category, Amount, Billing Cycle (Monthly, Bi-Weekly, Weekly, Annual), Due Day of Month, Autopay status, and Active toggle.
  - Urgent alert indicators for Overdue, Due in <7 days, and Settled.
- [x] **Predictive Cashflow Engine (30 / 60 / 90 / 180 / 365 Days)**:
  - Generates continuous day-by-day cashflow balance trajectory.
  - Aggregates recurring income events + scheduled recurring bill deductions + daily moving-average variable spending.
  - Highlights minimum liquidity trough (lowest balance point) and pinpoint date.
  - Low balance warning if projected balance breaches customizable liquidity threshold (e.g., $1,000 safety buffer).
- [x] **Interactive "What-If" Scenario Simulator**:
  - Add synthetic modifications: e.g. "Add $450/mo auto loan", "10% salary increase", "One-time $2,500 emergency repair on day 20", "Cancel 3 subscriptions".
  - Real-time delta comparison chart showing Baseline Forecast vs. Simulated Forecast.
- [x] **Category Budget vs Actuals**: Visual progress meters and variance analysis across essential vs. discretionary spending categories.
- [x] **Export & Import Data**: Full JSON data backup and export for user ownership and zero vendor lock-in.

### Phase 2 Features (Should Have — v1.1)
- [ ] Automated Bank Feed Webhooks (Plaid / MX / OpenBanking API sync).
- [ ] Multi-currency conversion with real-time FX rates.
- [ ] Push / Email notifications 48h before scheduled high-value payment deductions.

---

## 6. Technical Architecture
### Stack Decision
| Layer | Technology | Rationale |
|---|---|---|
| **Framework** | Next.js 15 (App Router) + React 19 | Server Components, fast route handlers, hybrid streaming, zero-config bundling. |
| **Styling & Design** | Tailwind CSS v4 + Lucide Icons | Clean 2026 design system, crisp 1px borders, tabular numerals, accessible contrast. |
| **State & Visualization** | Interactive SVG / Canvas Data Visualizer | Lightweight, zero external canvas lag, custom tooltips, responsive curves. |
| **Persistence / DB** | SQLite with structured JSON persistence / local file database | Deterministic, file-based, fast zero-latency ACID writes, zero external cloud barrier. |
| **Type Safety & Validation** | TypeScript 5.8 + Zod schema validation | Strict runtime and compile-time contract enforcement. |

### Architecture Decisions (ADRs)
- **ADR-001**: Single-tenant local database architecture for maximum privacy, zero data leakage, and offline capability.
- **ADR-002**: Pure-function deterministic projection engine executed both server-side for initial SSR rendering and client-side for zero-latency interactive what-if sliders.
- **ADR-003**: Unified recurring schedule expander that maps weekly, bi-weekly, monthly, quarterly, and annual intervals onto an exact calendar timeline with leap-year and month-end clamping (e.g., Feb 28/29, 30-day months).

---

## 7. Data Model (High-Level)
- `users` (id, name, currency, safety_buffer, created_at)
- `accounts` (id, name, type [checking, savings, credit], balance, updated_at)
- `categories` (id, name, type [income, expense], color, icon, monthly_budget)
- `transactions` (id, account_id, category_id, date, amount, type [income, expense], description, is_recurring, recurring_rule_id)
- `recurring_payments` (id, name, category_id, amount, type [income, expense], frequency [monthly, weekly, biweekly, quarterly, annual], due_day, next_due_date, autopay, active, notes)
- `scenarios` (id, name, description, baseline_balance, adjustments)

---

## 8. User Flows
### Primary Flow: Checking Spendings & Future Cashflow Health
1. User opens ApexFin Dashboard.
2. System computes current liquid balance across all accounts and runs the 90-day predictive cashflow timeline.
3. System flags upcoming obligations due within the next 7 days in the "Due Soon" widget.
4. User adjusts forecast window between 30, 60, 90, 180, and 365 days.
5. System displays the exact lowest liquidity date and estimated safety buffer breach date if any.
6. User enters the "What-If Simulator", drags the "Recurring Obligation Adjustment" slider, and immediately visualizes whether taking on a new expense will compromise their runway.

---

## 9. Non-Functional Requirements
| Requirement | Target |
|---|---|
| Server API Response Time | P99 < 40ms |
| Prediction Computation Time | < 15ms for 365 daily calculation nodes |
| UI Frame Rate | 60 FPS during charts and slider interactions |
| Data Durability | ACID transactional writes with atomic file swap / SQLite WAL mode |
| Accessibility | WCAG 2.2 AA compliant with high-contrast text and keyboard navigation |

---

## 10. Out of Scope (v1.0)
- Direct debit card issuance or real banking wire initiation (view-only financial intelligence).
- Crypto token speculation / blockchain wallet signatures.
- Multi-user team permission role matrix (v1 focused on personal/solopreneur ledger).

---

## 11. Open Questions
- *Resolved*: Initial currency standard defaults to USD (`$`), with configurable symbol support (EUR, GBP, IDR, JPY) in user settings.

---

## 12. Approval & Sign-off
| Stakeholder | Role | Status |
|---|---|---|
| Product Lead | Swarm Architect | Approved |
| Lead Craftsman | Fullstack Craftsman | Approved |
| Quality Auditor | Anti-Slop Sentinel | Approved |
