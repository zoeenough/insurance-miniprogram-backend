const mysql = require('mysql2/promise');
const config = require('./index');

let pool = null;

async function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      ...config.db,
      supportBigNumbers: true,
      bigNumberStrings: true
    });
  }
  return pool;
}

async function query(sql, params = []) {
  const pool = await getPool();
  // 将所有参数转换为字符串，避免MySQL 8.0的类型问题
  const stringParams = params.map(param => String(param));
  const [results] = await pool.execute(sql, stringParams);
  return results;
}

async function getConnection() {
  const pool = await getPool();
  return pool.getConnection();
}

async function transaction(callback) {
  const connection = await getConnection();
  await connection.beginTransaction();

  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  query,
  getConnection,
  transaction,
  closePool,
  getPool
};