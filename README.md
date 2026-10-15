# BRecharge Admin Portal — Starter

বাংলা UI-সহ Node.js + PostgreSQL admin portal starter। এটি development starter, production-ready recharge/payment system নয়।

## Included
- Admin login (123456789)
- Dashboard summary
- Retailer/distributor account creation and listing
- Wallet balance table and audited admin credit/debit API endpoint
- Recharge history view
- Commission rules create/list
- PostgreSQL schema
- Razorpay/recharge provider environment placeholders

## Requirements
- Node.js 18+
- PostgreSQL database

## Local setup
1. Install Node.js and PostgreSQL.
2. Extract ZIP, open terminal in project folder.
3. Run `npm install`.
4. Copy `.env.example` to `.env`.
5. Set `DATABASE_URL`, a long random `JWT_SECRET`, `ADMIN_EMAIL`, and a strong `ADMIN_PASSWORD`.
6. Create an empty PostgreSQL database named `brecharge` (or update DATABASE_URL).
7. Run `npm run db:init`.
8. Run `npm start`.
9. Open `http://localhost:3000`.

## Railway deployment
1. Push the project files to your private GitHub repository.
2. In Railway, create a PostgreSQL service and a Node.js service from the GitHub repository.
3. Set `DATABASE_URL` using Railway's PostgreSQL connection variable/reference.
4. Set `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in service Variables.
5. Set a start command of `npm start`.
6. Run `npm run db:init` once using Railway's shell/command workflow, or run it locally with the production DATABASE_URL only if you understand the risk.
7. Open the generated public URL and test `/api/health`.

## Important security notes
- Never commit `.env` or API secrets to GitHub.
- Change the initial admin password and use a unique long JWT secret.
- Use HTTPS in production.
- Add rate limiting, audit logging, backups, monitoring, and CSRF/origin protections before production.
- Wallet credit/debit must only be used after manual reconciliation and appropriate audit controls.
- This starter does not call a live recharge provider or Razorpay. Do not claim payment/recharge success until official provider responses and verified webhooks are implemented.
- A real recharge API requires your selected provider's official documentation, test credentials, callback/webhook handling, duplicate-request protection, status polling, and refund/reversal logic.
- Razorpay requires server-side order creation and signature/webhook verification before crediting a wallet.
- Have the implementation reviewed and tested before handling real customer money.
