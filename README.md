# CertDesk Console

A private SaaS console for managing the full SSL/TLS certificate lifecycle, built on the GoGetSSL partner API.

There is no public sign-up. The partner (master account) creates customer workspaces and logins. Customers sign in with email and password, see the orders assigned to them, buy new certificates, complete validation, download certificates and manage renewals.

## Screens

| Area | What it does |
| --- | --- |
| Overview | Totals, 12-week expiry horizon, health score, items that need attention, readiness for the 100-day lifetime limit, activity |
| Certificates | Inventory with status tabs, search, tags and an auto-renew switch per certificate |
| Certificate detail | Lifecycle tracker, validation records, certificate facts, renewal settings, downloads, reissue, cancel |
| Buy certificate | Six-step wizard: product, domains with DNS/CAA checks, plan, key and CSR generated in the browser, validation method, review |
| Validation center | Every pending DNS/HTTP/email validation with copyable records, re-check and method change |
| Renewals & automation | Expiry calendar, automation coverage, certificates expiring in 90 days |
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
| `CRON_SECRET` | Protects the daily sync endpoint |
| `AUTO_RENEW_ENABLED` | `true` lets CertDesk place renewal orders by itself. Off while testing |

## Database

Tables live in the `console` schema: `workspaces`, `users`, `sessions`, `products`, `orders`, `order_events`, `endpoints`, `api_log`, `kv`.

## Background sync

Order status is refreshed when a page is opened (pending orders, at most every few minutes), with the “Check now” button, and by a daily Vercel cron job at `/api/cron/sync`.
