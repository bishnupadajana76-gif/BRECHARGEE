const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: connectionString
    ? { rejectUnauthorized: false }
    : undefined
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
