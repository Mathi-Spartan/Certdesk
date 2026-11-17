import { neon } from '@neondatabase/serverless';

let _sql;
function client() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

/** Run a parameterised query and return all rows. */
export async function q(text, params = []) {
  return client().query(text, params);
}

/** Run a query and return the first row or null. */
export async function one(text, params = []) {
  const rows = await q(text, params);
  return rows[0] || null;
}
