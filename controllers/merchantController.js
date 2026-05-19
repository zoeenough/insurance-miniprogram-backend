const { query, transaction } = require('../config/database');
const bcrypt = require('bcryptjs');

async function getMerchants(req, res, next) {
  try {
    const { page = 1, pageSize = 10, status = 'all' } = req.query;
    const offset = (page - 1) * pageSize;

    let whereClause = '';
    const params = [];

    if (status !== 'all') {
      whereClause = 'WHERE m.status = ?';
      params.push(status);
    }

    const merchants = await query(
      `SELECT m.id, m.name, m.phone, m.created_at, m.status, u.id as user_id
       FROM merchants m
       LEFT JOIN users u ON u.merchant_id = m.id AND u.role = 'merchant'
       ${whereClause}
       ORDER BY m.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM merchants m ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        merchants,
        total: countResult[0].total
      }
    });
  } catch (error) {
    next(error);
  }
}

async function createMerchant(req, res, next) {
  try {
    const { name, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: '商家名称和手机号不能为空'
      });
    }

    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: '手机号格式不正确'
      });
    }

    const existingMerchants = await query(
      'SELECT id FROM merchants WHERE phone = ?',
      [phone]
    );

    if (existingMerchants.length > 0) {
      return res.status(400).json({
        success: false,
        message: '该手机号已被注册'
      });
    }

    const defaultPassword = '123456';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const result = await transaction(async (connection) => {
      const [merchantResult] = await connection.execute(
        'INSERT INTO merchants (name, phone, password, status) VALUES (?, ?, ?, ?)',
        [name, phone, hashedPassword, 'active']
      );

      const merchantId = merchantResult.insertId;

      await connection.execute(
        'INSERT INTO users (phone, password, role, merchant_id) VALUES (?, ?, ?, ?)',
        [phone, hashedPassword, 'merchant', merchantId]
      );

      return merchantId;
    });

    res.status(201).json({
      success: true,
      message: '商家创建成功，默认密码为123456',
      data: { id: result }
    });
  } catch (error) {
    next(error);
  }
}

async function updateMerchant(req, res, next) {
  try {
    const { id } = req.params;
    const { name, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: '商家名称和手机号不能为空'
      });
    }

    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: '手机号格式不正确'
      });
    }

    const existingMerchants = await query(
      'SELECT id FROM merchants WHERE phone = ? AND id != ?',
      [phone, id]
    );

    if (existingMerchants.length > 0) {
      return res.status(400).json({
        success: false,
        message: '该手机号已被其他商家使用'
      });
    }

    await query(
      'UPDATE merchants SET name = ?, phone = ? WHERE id = ?',
      [name, phone, id]
    );

    await query(
      'UPDATE users SET phone = ? WHERE merchant_id = ? AND role = ?',
      [phone, id, 'merchant']
    );

    res.json({
      success: true,
      message: '商家信息已更新'
    });
  } catch (error) {
    next(error);
  }
}

async function updateMerchantStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: '状态值无效，必须为active或inactive'
      });
    }

    const merchants = await query(
      'SELECT id FROM merchants WHERE id = ?',
      [id]
    );

    if (merchants.length === 0) {
      return res.status(404).json({
        success: false,
        message: '商家不存在'
      });
    }

    await query(
      'UPDATE merchants SET status = ? WHERE id = ?',
      [status, id]
    );

    res.json({
      success: true,
      message: status === 'active' ? '商家已启用' : '商家已禁用'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMerchants,
  createMerchant,
  updateMerchant,
  updateMerchantStatus
};
