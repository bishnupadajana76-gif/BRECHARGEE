require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const db = require("./db");
const { requireAuth, requireAdmin } = require("./auth");

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "../public")));

app.get("/api/health", async (_req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ ok: true, service: "BRecharge Admin API", database: "connected" });
  } catch {
    res.status(503).json({ ok: false, database: "disconnected" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    const result = await db.query(
      "SELECT id,name,email,password_hash,role,status FROM users WHERE lower(email)=lower($1)",
      [email.trim()]
    );
    const user = result.rows[0];
    if (!user || user.status !== "active" || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid login details" });
    }
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Login failed" });
  }
});

app.get("/api/admin/summary", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [users, recharges, pending, wallets, commissions] = await Promise.all([
      db.query("SELECT role, COUNT(*)::int AS count FROM users GROUP BY role"),
      db.query("SELECT COUNT(*)::int AS count, COALESCE(SUM(amount),0)::numeric(14,2) AS total FROM recharges"),
      db.query("SELECT COUNT(*)::int AS count FROM recharges WHERE status='pending'"),
      db.query("SELECT COALESCE(SUM(balance),0)::numeric(14,2) AS total FROM wallets"),
      db.query("SELECT COUNT(*)::int AS count FROM commission_rules WHERE active=true")
    ]);
    res.json({
      users: users.rows,
      rechargeCount: recharges.rows[0].count,
      rechargeVolume: recharges.rows[0].total,
      pendingRecharges: pending.rows[0].count,
      walletBalanceTotal: wallets.rows[0].total,
      activeCommissionRules: commissions.rows[0].count
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not load dashboard" });
  }
});

app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
  const role = req.query.role;
  const params = [];
  let where = "";
  if (["admin", "distributor", "retailer"].includes(role)) {
    params.push(role);
    where = "WHERE u.role=$1";
  }
  const result = await db.query(
    `SELECT u.id,u.name,u.email,u.role,u.status,u.created_at,COALESCE(w.balance,0) AS wallet_balance
     FROM users u LEFT JOIN wallets w ON w.user_id=u.id ${where}
     ORDER BY u.created_at DESC LIMIT 200`, params
  );
  res.json(result.rows);
});

app.post("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password || password.length < 12 ||
      !["distributor", "retailer"].includes(role)) {
    return res.status(400).json({ error: "Name, email, 12+ character password and valid role required" });
  }
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const hash = await bcrypt.hash(password, 12);
    const created = await client.query(
      "INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,name,email,role,status,created_at",
      [name.trim(), email.trim().toLowerCase(), hash, role]
    );
    await client.query("INSERT INTO wallets(user_id,balance) VALUES($1,0)", [created.rows[0].id]);
    await client.query("COMMIT");
    res.status(201).json(created.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    if (e.code === "23505") return res.status(409).json({ error: "Email already exists" });
    console.error(e);
    res.status(500).json({ error: "Could not create user" });
  } finally { client.release(); }
});

app.get("/api/admin/recharges", requireAuth, requireAdmin, async (_req, res) => {
  const result = await db.query(
    `SELECT r.id,r.mobile_number,r.operator,r.amount,r.status,r.provider_reference,r.created_at,
            u.name AS user_name,u.email AS user_email
     FROM recharges r JOIN users u ON u.id=r.user_id
     ORDER BY r.created_at DESC LIMIT 200`
  );
  res.json(result.rows);
});

app.get("/api/admin/commissions", requireAuth, requireAdmin, async (_req, res) => {
  const result = await db.query("SELECT * FROM commission_rules ORDER BY created_at DESC LIMIT 200");
  res.json(result.rows);
});

app.post("/api/admin/commissions", requireAuth, requireAdmin, async (req, res) => {
  const { name, operator = "ALL", service_type = "mobile", role = "retailer", percent = 0, flat_amount = 0 } = req.body || {};
  const pct = Number(percent), flat = Number(flat_amount);
  if (!name || !["retailer", "distributor"].includes(role) ||
      !Number.isFinite(pct) || pct < 0 || pct > 100 ||
      !Number.isFinite(flat) || flat < 0) {
    return res.status(400).json({ error: "Enter valid commission rule values" });
  }
  const result = await db.query(
    `INSERT INTO commission_rules(name,operator,service_type,role,percent,flat_amount)
     VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
    [name.trim(), operator, service_type, role, pct, flat]
  );
  res.status(201).json(result.rows[0]);
});

app.post("/api/admin/users/:id/wallet-adjustment", requireAuth, requireAdmin, async (req, res) => {
  const amount = Number(req.body?.amount);
  const type = req.body?.type;
  const note = String(req.body?.note || "").slice(0, 250);
  if (!Number.isFinite(amount) || amount <= 0 || !["credit", "debit"].includes(type)) {
    return res.status(400).json({ error: "Valid positive amount and credit/debit type required" });
  }
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const user = await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [req.params.id]);
    if (!user.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ error: "User not found" }); }
    const wallet = await client.query("SELECT balance FROM wallets WHERE user_id=$1 FOR UPDATE", [req.params.id]);
    if (!wallet.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Wallet not found" }); }
    const delta = type === "credit" ? amount : -amount;
    const updated = await client.query(
      "UPDATE wallets SET balance=balance+$1,updated_at=NOW() WHERE user_id=$2 AND balance+$1>=0 RETURNING balance",
      [delta, req.params.id]
    );
    if (!updated.rowCount) { await client.query("ROLLBACK"); return res.status(400).json({ error: "Insufficient wallet balance" }); }
    await client.query(
      "INSERT INTO wallet_transactions(user_id,type,amount,note,created_by) VALUES($1,$2,$3,$4,$5)",
      [req.params.id, type, amount, note, req.user.id]
    );
    await client.query("COMMIT");
    res.json({ balance: updated.rows[0].balance });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    res.status(500).json({ error: "Wallet adjustment failed" });
  } finally { client.release(); }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "../public/index.html")));

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`BRecharge admin portal running on port ${port}`));
