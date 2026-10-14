require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("./db");

async function main() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin','distributor','retailer')),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS wallets (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      balance NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL CHECK (type IN ('credit','debit')),
      amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
      reference TEXT,
      note TEXT,
      created_by BIGINT REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS commission_rules (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      operator TEXT NOT NULL DEFAULT 'ALL',
      service_type TEXT NOT NULL DEFAULT 'mobile',
      role TEXT NOT NULL DEFAULT 'retailer',
      percent NUMERIC(7,4) NOT NULL DEFAULT 0,
      flat_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS recharges (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      mobile_number TEXT NOT NULL,
      operator TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed','refunded')),
      provider_reference TEXT,
      provider_response JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS payment_orders (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
      gateway TEXT NOT NULL DEFAULT 'razorpay',
      gateway_order_id TEXT,
      status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','paid','failed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const email = process.env.ADMIN_EMAIL || "admin@example.com";
  const password = process.env.ADMIN_PASSWORD || "ChangeThisPassword123!";
  const name = process.env.ADMIN_NAME || "BRecharge Admin";
  const existing = await db.query("SELECT id FROM users WHERE email=$1", [email]);
  if (existing.rowCount === 0) {
    const hash = await bcrypt.hash(password, 12);
    const result = await db.query(
      "INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'admin') RETURNING id",
      [name, email, hash]
    );
    await db.query("INSERT INTO wallets(user_id,balance) VALUES($1,0)", [result.rows[0].id]);
    console.log(`Admin created: ${email}. Change the initial password before production.`);
  } else {
    console.log("Admin account already exists; no password changed.");
  }
  await db.pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await db.pool.end();
  process.exit(1);
});
