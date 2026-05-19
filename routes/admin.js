const express = require('express');
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.use(authorize('insurance', 'admin'));

router.get('/dashboard', async (req, res, next) => {
  try {
    const dashboardStats = await query(
      `SELECT 
        (SELECT COUNT(*) FROM users WHERE role = 'merchant') as totalMerchants,
        (SELECT COUNT(*) FROM users WHERE role = 'customer') as totalCustomers,
        (SELECT COUNT(*) FROM insurance_records) as totalRecords,
        (SELECT COUNT(*) FROM insurance_records WHERE is_activated = 1) as activatedRecords,
        (SELECT COUNT(*) FROM activation_applications WHERE status = 'pending') as pendingActivations,
        (SELECT COUNT(*) FROM serial_modifications WHERE status = 'pending') as pendingModifications,
        (SELECT SUM(insurance_amount) FROM insurance_records) as totalRevenue`
    );

    res.json({
      success: true,
      data: dashboardStats[0]
    });
  } catch (error) {
    next(error);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const { page = 1, pageSize = 10, role = 'all' } = req.query;
    const offset = (page - 1) * pageSize;

    let whereClause = '';
    const params = [];

    if (role !== 'all') {
      whereClause = 'WHERE role = ?';
      params.push(role);
    }

    const users = await query(
      `SELECT * FROM users ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        users,
        total: countResult[0].total
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/records', async (req, res, next) => {
  try {
    const { page = 1, pageSize = 15 } = req.query;
    const offset = (page - 1) * pageSize;

    const records = await query(
      `SELECT ir.*, m.name as merchant_name, m.phone as merchant_phone
       FROM insurance_records ir
       LEFT JOIN merchants m ON ir.merchant_id = m.id
       ORDER BY ir.created_at DESC 
       LIMIT ? OFFSET ?`,
      [parseInt(pageSize), offset]
    );

    const countResult = await query('SELECT COUNT(*) as total FROM insurance_records');

    res.json({
      success: true,
      data: {
        records,
        total: countResult[0].total
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
