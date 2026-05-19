const express = require('express');
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { calculateRemainingDays } = require('../utils/calculateDays');

const router = express.Router();

router.use(authenticate);
router.use(authorize('customer'));

router.get('/info', async (req, res, next) => {
  try {
    const users = await query(
      'SELECT id, phone FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const statsResult = await query(
      `SELECT 
        COUNT(*) as totalInsurances,
        SUM(CASE WHEN sales_status = 'activated' THEN 1 ELSE 0 END) as activeInsurances
       FROM insurance_records ir
       INNER JOIN activation_applications aa ON ir.id = aa.insurance_record_id
       WHERE aa.customer_phone = ? AND aa.status = 'approved'`,
      [users[0].phone]
    );

    res.json({
      success: true,
      data: {
        ...users[0],
        ...statsResult[0]
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/activate', async (req, res, next) => {
  try {
    const { serialNumber, customerPhone } = req.body;

    if (!serialNumber || !customerPhone) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段'
      });
    }

    const records = await query(
      'SELECT * FROM insurance_records WHERE serial_number = ?',
      [serialNumber]
    );

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: '该串号在保险库中不存在'
      });
    }

    const record = records[0];

    if (record.is_activated === 1) {
      return res.status(400).json({
        success: false,
        message: '保险已激活'
      });
    }

    const remainingDays = calculateRemainingDays(record.start_time, record.activation_time);

    if (remainingDays < 0) {
      return res.status(400).json({
        success: false,
        message: '保险已过期'
      });
    }

    if (remainingDays >= 365) {
      await query(
        'UPDATE insurance_records SET is_activated = 1, activation_time = NOW(), sales_status = ? WHERE id = ?',
        ['activated', record.id]
      );

      await query(
        `INSERT INTO activation_applications (insurance_record_id, customer_phone, status, reviewed_at)
         VALUES (?, ?, 'approved', NOW())`,
        [record.id, customerPhone]
      );

      res.json({
        success: true,
        message: '保险激活成功,已激活12个月',
        data: {
          activation_time: new Date(),
          remaining_days: 365
        }
      });
    } else {
      const existingApplications = await query(
        'SELECT * FROM activation_applications WHERE insurance_record_id = ? AND customer_phone = ? AND status = ?',
        [record.id, customerPhone, 'pending']
      );

      if (existingApplications.length > 0) {
        return res.status(409).json({
          success: false,
          message: '激活申请已存在,请等待审核'
        });
      }

      const result = await query(
        `INSERT INTO activation_applications (insurance_record_id, customer_phone, status)
         VALUES (?, ?, 'pending')`,
        [record.id, customerPhone]
      );

      res.status(201).json({
        success: true,
        message: `剩余天数不足12个月(${remainingDays}天),激活申请已提交,请等待审核`,
        data: {
          id: result.insertId,
          remaining_days: remainingDays,
          status: 'pending'
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

router.get('/my-insurance', async (req, res, next) => {
  try {
    const { page = 1, pageSize = 10 } = req.query;
    const offset = (page - 1) * pageSize;

    const insurances = await query(
      `SELECT ir.*, aa.status as activation_status, aa.created_at as activation_created_at, 
              m.name as merchant_name
       FROM insurance_records ir
       INNER JOIN activation_applications aa ON ir.id = aa.insurance_record_id
       LEFT JOIN merchants m ON ir.merchant_id = m.id
       WHERE aa.customer_phone = ? AND aa.status = 'approved' AND ir.is_activated = 1
       ORDER BY aa.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.user.phone, parseInt(pageSize), offset]
    );

    const insurancesWithDays = insurances.map(insurance => ({
      ...insurance,
      remaining_days: calculateRemainingDays(insurance.start_time, insurance.activation_time)
    }));

    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM insurance_records ir
       INNER JOIN activation_applications aa ON ir.id = aa.insurance_record_id
       WHERE aa.customer_phone = ? AND aa.status = 'approved' AND ir.is_activated = 1`,
      [req.user.phone]
    );

    res.json({
      success: true,
      data: {
        insurances: insurancesWithDays,
        total: countResult[0].total
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/insurances', async (req, res, next) => {
  try {
    const { page = 1, pageSize = 10 } = req.query;
    const offset = (page - 1) * pageSize;

    const insurances = await query(
      `SELECT ir.*, aa.status as activation_status, aa.created_at as activation_created_at
       FROM insurance_records ir
       INNER JOIN activation_applications aa ON ir.id = aa.insurance_record_id
       WHERE aa.customer_phone = ? AND aa.status = 'approved'
       ORDER BY aa.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.user.phone, parseInt(pageSize), offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM insurance_records ir
       INNER JOIN activation_applications aa ON ir.id = aa.insurance_record_id
       WHERE aa.customer_phone = ? AND aa.status = 'approved'`,
      [req.user.phone]
    );

    res.json({
      success: true,
      data: {
        insurances,
        total: countResult[0].total
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
