# CertDesk Console

A private SaaS console for managing the full SSL/TLS certificate lifecycle, built on the GoGetSSL partner API.

There is no public sign-up. The partner (master account) creates customer workspaces and logins. Customers sign in with email and password, see the orders assigned to them, buy new certificates, complete validation, download certificates, reissue and renew.

Everything is managed by hand. CertDesk tracks two separate clocks for every order:

- **Certificate**: lasts at most 200 days (100 days from 15 Mar 2027). Before it expires, the customer **reissues** it, which is free while the order is active.
- **Order**: the purchased term (for example 12 months). When it ends, the customer **renews**, which places a new order.

Automation products (Plan + Automate, ACME, Certificate-as-a-Service) are kept out of the catalogue for a later phase.

## Screens

| Area | What it does |
| --- | --- |
| Overview | Totals, reissues and renewals due, 12-week schedule, health score, items that need attention, activity |
| Certificates | Inventory with status tabs, search, tags, certificate expiry and order end per row |
| Certificate detail | Lifecycle (ordered, validated, issued, reissue, certificate expiry, order end), validation records, certificate and order clocks, reminder, downloads, reissue, renew, cancel |
| Buy certificate | Six-step wizard: product, domains with DNS/CAA checks, plan, key and CSR generated in the browser, validation method, review |
| Validation center | Every pending DNS/HTTP/email validation with copyable records, re-check and method change |
| Reissues & renewals | Calendar of certificate expiries and order ends, certificates to reissue, orders to renew |
| Orders & billing | Order history per workspace |
| Partner | Customer workspaces, logins, assigning existing GoGetSSL orders, catalogue on/off switches, API health |

## Stack

- Next.js (App Router) on Vercel
- Neon Postgres, schema `console`
- GoGetSSL REST API, called only from the server

Private keys are generated in the customer's browser with WebCrypto and downloaded straight to their computer. They are never sent to the server.

## Environment variables

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon connection string |
| `GOGETSSL_USER` | GoGetSSL client-area login |
| `GOGETSSL_PASS` | GoGetSSL API password (Reseller Modules → API settings) |
| `GOGETSSL_API_URL` | Optional, defaults to `https://my.gogetssl.com/api` |
| `GOGETSSL_PARTNER_CODE` | Partner code for API v2 (Plan + Automate, ACME CaaS) |
| `GOGETSSL_V2_PASS` | Optional. API v2 password, if different from `GOGETSSL_PASS` |
| `CRON_SECRET` | Protects the daily sync endpoint |

## Database

Tables live in the `console` schema: `workspaces`, `users`, `sessions`, `products`, `orders`, `order_events`, `endpoints`, `api_log`, `kv`.

## Background sync

Order status is refreshed when a page is opened (pending orders, at most every few minutes), with the “Check status now” button, and by a daily Vercel cron job at `/api/cron/sync`.

GoGetSSL allows “re-check” (revalidate) and “resend approval email” only once every 5 minutes per order. CertDesk remembers each lock and shows a countdown on the button instead of calling again.

## Automated SSL subscriptions (API v2)

Plan + Automate (products 400–403) and Sectigo ACME Certificate-as-a-Service (product 300) live in their own section, **Automated SSL**. They use GoGetSSL API v2 (`https://my.gogetssl.com/api/v2`, header `Authorization: GGS <partner code>:<API password>`).

- Order a subscription, see its status, term dates and next renewal
- ACME CaaS: EAB key ID, HMAC key and directory URL, add and remove domains
- Plan + Automate: AutoInstall SSL sign-in links, switch between AutoInstall and ACME
- Turn auto-renewal on or off, cancel with an optional refund request
- Every endpoint used is listed under Automated SSL → API v2 endpoints, with the last call made to it

The tables are in `db/subscriptions.sql`. The manual certificate pages are unchanged.
