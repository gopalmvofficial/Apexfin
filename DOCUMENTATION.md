# ApexFin Documentation & Architectural Blueprint

**Version**: 1.1.0  
**Stack**: Next.js 15 (App Router), React 19, TypeScript 5.8, Tailwind CSS v4, Lucide Icons, Spatial WebGL/Canvas 3D, Web Audio API  
**Design Standard**: Apple Human Interface Guidelines (HIG) + 2026 Modern Spatial UI  
**Deployment**: Vercel Serverless / Cloudflare Edge (Zero-Cost Permanent Hosting)  

---

## 1. Architectural System Overview

ApexFin is structured around an event-driven predictive financial projection pipeline. The application integrates:
1. **Interactive Spatial 3D Canvas (`Spatial3DCanvas.tsx`)**: High-performance 60fps 3D particle mesh that responds to scroll and cursor parallax, shifting ambient hue based on financial health (`safe`, `warning`, `scenario`).
2. **Tactile 3D Holographic Liquidity Card (`HolographicCard3D.tsx`)**: Realistic 3D gyroscopic tilt, specular light sheen reflections, EMV chip visual, and real-time runway status badge.
3. **Continuous Forward Projection Engine (`predictive-engine.ts`)**: Pure deterministic cashflow simulator over 30, 60, 90, 180, and 365 days.
4. **Interactive "What-If" Scenario Simulator (`WhatIfSimulator.tsx`)**: Real-time delta comparison modeling against baseline liquidity.
5. **Harmonic Web Audio Synthesizer (`sound-effects.ts`)**: Ultra-light client-side synthesized feedback tones for tactile interactions (toggleable in navigation header).
6. **Apple WebKit & PWA Engine (`manifest.webmanifest`)**: Full compatibility with iOS 18+ Dynamic Island, Home Indicator safe areas, and standalone Home Screen installation.

---

## 2. Accessibility (WCAG 2.2 AA) & Apple HIG Standards

ApexFin enforces strict accessibility invariants verified via automated CI test suite (`npm run test:a11y`):
- **Motion Sensitivity**: Dedicated `@media (prefers-reduced-motion: reduce)` disabling 3D canvas and animations for sensitive users.
- **Safari Auto-Zoom Prevention**: Enforces `font-size: max(16px, ...)` on all input elements.
- **Apple Touch Targets**: Minimum 44x44pt on coarse pointer devices.
- **Safe Area Insets**: Handled via `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` with `viewport-fit=cover`.
- **Screen Reader Support**: Semantic landmarks (`<header>`, `<main role="main">`, `<div role="region">`), and explicit `aria-label` attributes.

---

## 3. Automated Free Permanent Cloud Deployment Pipeline

### 3.1 Zero-Cost Cloud Deployment (Vercel / Cloudflare)
ApexFin is engineered for **100% free permanent deployment**:
- **Vercel Free Hobby Tier**: Infinite automatic deployments, SSL, global CDN edge, and zero server maintenance cost.
- **Configuration**: Configured via [**`vercel.json`**](file:///d:/CLAUDE%20PROJECTS/new/vercel.json) with HTTP security headers (`nosniff`, `DENY` clickjacking, strict referrer policy).

### 3.2 Continuous Integration & Deployment Workflow
Configured in [**`.github/workflows/deploy.yml`**](file:///d:/CLAUDE%20PROJECTS/new/.github/workflows/deploy.yml):
1. **Trigger**: Push to `main` branch or pull request.
2. **Phase 1 (Quality Gate)**:
   - Installs dependencies on Node.js 24 with npm caching.
   - Runs predictive engine unit tests (`npm test`).
   - Runs automated accessibility audit (`npm run test:a11y`).
   - Verifies Next.js production bundle build (`npm run build`).
3. **Phase 2 (Cloud Deployment)**:
   - Automatically publishes the verified bundle directly to production on Vercel.

---

## 4. Verification & Test Commands

```bash
# 1. Run Predictive Engine Test Suite (3/3 passing)
npm test

# 2. Run Automated Accessibility (a11y) Audit (5/5 passing)
npm run test:a11y

# 3. Build Next.js 15 Production Bundle
npm run build

# 4. Deploy Live to Cloud via Vercel CLI (1-command permanent hosting)
npx vercel --prod
```
