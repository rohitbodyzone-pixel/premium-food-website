# PropertyTalk — Phase 3A: Production Integration Readiness Guide

## 1. Executive Summary

**Phase 3A (Production Integration Readiness)** transitions PropertyTalk from isolated local mocks to external production-grade services without enabling real-money payments or live Stripe transactions.

Every external integration (SMS, Transactional Email, WebRTC Audio/Video, Stripe Payments, Web Push) is architected with dual operation modes:
1. **Configured Mode**: Operates seamlessly when real external API credentials are provided.
2. **Safe Fallback Mode**: Gracefully falls back to local development providers (Dev SMS, Dev Email, Mock Payment Provider, STUN-only WebRTC, Socket.io in-app push) when credentials are not configured.

---

## 2. Portal URLs & Port Allocation

All portal entry points remain strictly preserved on their dedicated ports:

| Service / Portal | Canonical URL | Primary Role / Audience |
| :--- | :--- | :--- |
| **Customer Portal** | `http://localhost:5173/` | Property search, categories, expert directory, bookings, calls, chats, wallet |
| **Expert Portal** | `http://localhost:5174/` | Realtime consult requests, accept/decline, presence, schedule, rates, earnings |
| **Super Admin Portal**| `http://localhost:5175/` | System status, verifications, financial governance, audit logs, notification telemetry |
| **Backend API Server** | `http://localhost:5000/` | Express API, Socket.io signalling, database ORM, background scheduler |

---

## 3. Production Safety Guards & Zero-Risk Guarantees

### 3.1 Strict Stripe Live Key Blocker (`sk_live_`)
- In Phase 3A, the backend **strictly prohibits** Stripe live keys.
- If `STRIPE_SECRET_KEY` starting with `sk_live_` is configured, both the factory `getPaymentProvider()` and `StripePaymentProvider` constructor throw an explicit error:
  ```
  Stripe live mode is disabled during Phase 3A. Only test credentials (sk_test_) are permitted.
  ```
- Only test credentials (`sk_test_...` and `pk_test_...`) or `MockPaymentProvider` are permitted.
- **Zero real credit cards will ever be charged.**

### 3.2 Production Redaction of Sensitive Tokens & OTPs
- When `NODE_ENV === 'production'`:
  - `DevelopmentSmsProvider` redacts recipient phone numbers (`+64***12`) and **never prints plaintext OTPs** to the console.
  - `DevelopmentEmailProvider` suppresses verification links, password reset tokens, and action OTPs from stdout.

### 3.3 Public Health Check Minimal Privacy
- `GET /api/health` returns only:
  ```json
  {
    "status": "ok",
    "service": "PropertyTalk API",
    "timestamp": "2026-09-08T00:40:00.000Z"
  }
  ```
- Internal configuration, database topology, and provider secrets are never leaked to unauthenticated callers.

### 3.4 Super Admin System Status (`GET /api/admin/system-status`)
- Authoritative protection: requires `requireAuth` + `SUPER_ADMIN` role.
- Returns comprehensive status for all 8 subsystems (`backend`, `database`, `realtimeSocket`, `webrtc`, `sms`, `email`, `payment`, `webPush`, `governance`, `metrics`).
- Displays provider names, connection states, and masked metadata only. **Zero secrets, tokens, or private keys are exposed.**

---

## 4. Integration Matrix & Fallback Architecture

| Subsystem | External Provider | Environment Variables | Safe Development Fallback |
| :--- | :--- | :--- | :--- |
| **SMS Gateway** | Twilio | `TWILIO_ACCOUNT_SID`<br>`TWILIO_AUTH_TOKEN`<br>`TWILIO_PHONE_NUMBER` | `DevelopmentSmsProvider`<br>(In-memory test log + console preview) |
| **Transactional Email** | Resend | `RESEND_API_KEY`<br>`EMAIL_FROM_ADDRESS`<br>`EMAIL_FROM_NAME` | `DevelopmentEmailProvider`<br>(Console preview with link logging) |
| **WebRTC Audio/Video** | STUN + TURN Relay | `WEBRTC_STUN_URLS`<br>`WEBRTC_TURN_URL`<br>`WEBRTC_TURN_USERNAME`<br>`WEBRTC_TURN_CREDENTIAL` | Default Google Public STUN (`stun:stun.l.google.com:19302`) |
| **Payments & Billing** | Stripe (Test Mode) | `STRIPE_SECRET_KEY` (`sk_test_`)<br>`STRIPE_PUBLISHABLE_KEY` (`pk_test_`)<br>`STRIPE_WEBHOOK_SECRET` | `MockPaymentProvider`<br>(Simulated card setups, auths, captures) |
| **Web Push Alerts** | Browser Push (VAPID) | `WEB_PUSH_PUBLIC_KEY`<br>`WEB_PUSH_PRIVATE_KEY`<br>`WEB_PUSH_SUBJECT` | In-app Socket.io realtime push badges & notifications |

---

## 5. Web Push Notification Foundation

1. **Service Worker (`client/public/sw.js`)**:
   - Handles background browser push events.
   - Displays browser native notifications with priority and interaction rules.
   - Focuses existing portal window or opens relevant destination on notification click.

2. **Non-Intrusive Permission UX**:
   - Notifications permission is **NEVER requested on page load**.
   - User must explicitly toggle "Browser Push Notifications" under `NotificationsPage -> Delivery Channels`.
   - If user denies permission, a polite explanation appears without breaking in-app alerts.

---

## 6. Preservation of Core Consultation Guarantees

1. **First 1 Minute FREE (60 Seconds)**:
   - Configured in `SystemConfig` (`free_call_duration_seconds = 60`).
   - Ticker starts **ONLY** when the Expert clicks **ACCEPT** and status transitions to `CONNECTED`.
   - Customer profile visits, messaging before accept, and unaccepted requests consume **zero** free time.
2. **Zero Automatic Charging**:
   - When the free minute expires, the consultation pauses automatically.
   - The user must explicitly approve continuing as a paid consultation with card on file.
   - If not approved, consultation ends with zero charge.

---

## 7. External Service Onboarding Checklist

When ready to connect real external accounts, follow these steps:

### 1. Twilio SMS
1. Sign up at [twilio.com](https://www.twilio.com/).
2. Obtain **Account SID**, **Auth Token**, and an **Active Phone Number**.
3. In `server/.env`:
   ```env
   SMS_PROVIDER="twilio"
   TWILIO_ACCOUNT_SID="ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
   TWILIO_AUTH_TOKEN="your_auth_token_here"
   TWILIO_PHONE_NUMBER="+1234567890"
   ```

### 2. Resend Email
1. Sign up at [resend.com](https://resend.com/).
2. Create an API Key with sending permissions.
3. Verify your sending domain (or use test onboarding domain).
4. In `server/.env`:
   ```env
   EMAIL_PROVIDER="resend"
   RESEND_API_KEY="re_123456789"
   EMAIL_FROM_ADDRESS="notifications@yourdomain.com"
   EMAIL_FROM_NAME="PropertyTalk"
   ```

### 3. WebRTC TURN Server
1. Provision a TURN relay service (e.g. Metered.ca, Twilio Network Traversal, or self-hosted Coturn).
2. In `server/.env`:
   ```env
   WEBRTC_TURN_URL="turn:turn.yourdomain.com:3478"
   WEBRTC_TURN_USERNAME="turn_username"
   WEBRTC_TURN_CREDENTIAL="turn_password"
   ```

### 4. Stripe (Test Mode Only)
1. Sign up at [stripe.com](https://stripe.com/).
2. Enable "Test Mode" toggle in Stripe Dashboard.
3. Obtain test keys starting with `sk_test_` and `pk_test_`.
4. In `server/.env`:
   ```env
   PAYMENT_PROVIDER="stripe"
   STRIPE_SECRET_KEY="sk_test_..."
   STRIPE_PUBLISHABLE_KEY="pk_test_..."
   STRIPE_WEBHOOK_SECRET="whsec_..."
   ```

### 5. Web Push VAPID Keys
1. Generate VAPID keypair in terminal:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. In `server/.env`:
   ```env
   WEB_PUSH_PUBLIC_KEY="your_public_key"
   WEB_PUSH_PRIVATE_KEY="your_private_key"
   WEB_PUSH_SUBJECT="mailto:admin@yourdomain.com"
   ```

---

## 8. Verification & Master Automated Test Suite

Run the full automated test suite:
```bash
cd server
npm test
```

Expected result:
```
====================================================
  ALL TEST SUITES FINISHED
  TOTAL PASSED: 229
  TOTAL FAILED: 0
====================================================
```
