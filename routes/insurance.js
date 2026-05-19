const express = require('express');
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { calculateRemainingDays } = require('../utils/calculateDays');

const router = express.Router();

router.use(authenticate);
router.use(authorize('insurance'));

router.get('/info', async (req, res, next) => {
  try {
    const users = await query(
      'SELECT * FROM users WHERE id = ? AND role = ?',
      [req.user.id, 'insurance']
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: '保险方信息不存在'
      });
    }

    const companies = await query(
      'SELECT * FROM insurance_companies WHERE user_id = ?',
      [req.user.id]
    );

    res.json({
      success: true,
      data: {
        user: users[0],
        company: companies.length > 0 ? companies[0] : null
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const statsResult = await query(
      `SELECT 
        COUNT(DISTINCT merchant_id) as totalMerchants,
        COUNT(*) as totalRecords,
        SUM(CASE WHEN is_activated = 0 AND sales_status = 'pending' THEN 1 ELSE 0 END) as pendingActivations,
        (SELECT COUNT(*) FROM serial_modifications WHERE status = 'pending') as pendingModifications,
        SUM(CASE WHEN DATE_FORMAT(start_time, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m') THEN insurance_amount ELSE 0 END) as monthlyRevenue
       FROM insurance_records`
    );

    res.json({
      success: true,
      data: statsResult[0]
    });
  } catch (error) {
    next(error);
  }
});

router.get('/records', async (req, res, next) => {
  try {
    const { page = 1, pageSize = 15, merchantId = '' } = req.query;
    const pageNum = parseInt(page);
    const size = parseInt(pageSize);
    const offset = (pageNum - 1) * size;

    let whereClause = '';
    const params = [];

    if (merchantId) {
      whereClause = 'WHERE ir.merchant_id = ?';
      params.push(parseInt(merchantId));
    }

    const records = await query(
      `SELECT ir.*, m.name as merchant_name 
       FROM insurance_records ir
       LEFT JOIN merchants m ON ir.merchant_id = m.id
       ${whereClause}
       ORDER BY ir.created_at DESC 
       LIMIT ? OFFSET ?`,
      [...params, size, offset]
    );

    const recordsWithDays = records.map(record => ({
      ...record,
      remaining_days: calculateRemainingDays(record.start_time, record.activation_time)
    }));

    let countQuery = `SELECT COUNT(*) as total FROM insurance_records ir
                     LEFT JOIN merchants m ON ir.merchant_id = m.id
                     ${whereClause}`;

    const countResult = await query(countQuery, params);

    res.json({
      success: true,
      data: {
        records: recordsWithDays,
        total: countResult[0].total
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/merchants', async (req, res, next) => {
  try {
    const { page = 1, pageSize = 10, status = 'all' } = req.query;
    const pageNum = parseInt(page);
    const size = parseInt(pageSize);
    const offset = (pageNum - 1) * size;

    let whereClause = '';
    const params = [];

    if (status !== 'all') {
      whereClause = 'WHERE status = ?';
      params.push(status);
    }

    const merchants = await query(
      `SELECT * FROM merchants ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, size, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM merchants ${whereClause}`,
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
});

router.post('/merchant/:id/approve', async (req, res, next) => {
  try {
    const { id } = req.params;

    await query(
      'UPDATE merchants SET status = ? WHERE id = ?',
      ['active', id]
    );

    res.json({
      success: true,
      message: '商家已通过'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/merchant/:id/reject', async (req, res, next) => {
  try {
    const { id } = req.params;

    await query(
      'UPDATE merchants SET status = ? WHERE id = ?',
      ['inactive', id]
    );

    res.json({
      success: true,
      message: '商家已拒绝'
    });
  } catch (error) {
    next(error);
  }
});

router.put('/merchant/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: '状态值无效'
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
});

router.get('/library', async (req, res, next) => {
  try {
    const { page = 1, pageSize = 15, keyword = '' } = req.query;
    const pageNum = parseInt(page);
    const size = parseInt(pageSize);
    const offset = (pageNum - 1) * size;

    let whereClause = '';
    const params = [];

    if (keyword) {
      whereClause = 'WHERE ir.serial_number LIKE ? OR ir.phone_brand LIKE ? OR ir.phone_model LIKE ? OR m.name LIKE ?';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword, likeKeyword);
    }

    const records = await query(
      `SELECT ir.*, m.name as merchant_name 
       FROM insurance_records ir
       LEFT JOIN merchants m ON ir.merchant_id = m.id
       ${whereClause}
       ORDER BY ir.created_at DESC 
       LIMIT ? OFFSET ?`,
      [...params, size, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM insurance_records ir
       LEFT JOIN merchants m ON ir.merchant_id = m.id
       ${whereClause}`,
      params
    );

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

router.get('/activation-applications', async (req, res, next) => {
  try {
    const { page = 1, pageSize = 10, status = 'pending' } = req.query;
    const pageNum = parseInt(page);
    const size = parseInt(pageSize);
    const offset = (pageNum - 1) * size;

    const applications = await query(
      `SELECT aa.*, ir.phone_brand, ir.phone_model, ir.serial_number, ir.cost_amount, ir.insurance_amount, m.name as merchant_name
       FROM activation_applications aa
       LEFT JOIN insurance_records ir ON aa.insurance_record_id = ir.id
       LEFT JOIN merchants m ON ir.merchant_id = m.id
       WHERE aa.status = ?
       ORDER BY aa.created_at DESC 
       LIMIT ? OFFSET ?`,
      [status, size, offset]
    );

    res.json({
      success: true,
      data: { applications }
    });
  } catch (error) {
    next(error);
  }
});

router.put('/activation-applications/:id/review', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, rejectReason } = req.body;

    const applications = await query(
      'SELECT * FROM activation_applications WHERE id = ?',
      [id]
    );

    if (applications.length === 0) {
      return res.status(404).json({
        success: false,
        message: '激活申请不存在'
      });
    }

    const application = applications[0];

    if (action === 'approve') {
      await query(
        'UPDATE activation_applications SET status = ?, reviewed_at = NOW() WHERE id = ?',
        ['approved', id]
      );

      await query(
        'UPDATE insurance_records SET is_activated = 1, activation_time = NOW(), sales_status = ? WHERE id = ?',
        ['activated', application.insurance_record_id]
      );

      res.json({
        success: true,
        message: '激活申请已通过,保险已激活12个月'
      });
    } else if (action === 'reject') {
      await query(
        'UPDATE activation_applications SET status = ?, reject_reason = ?, reviewed_at = NOW() WHERE id = ?',
        ['rejected', rejectReason || '', id]
      );

      res.json({
        success: true,
        message: '激活申请已拒绝'
      });
    } else {
      return res.status(400).json({
        success: false,
        message: '无效的操作'
      });
    }
  } catch (error) {
    next(error);
  }
});

router.get('/serial-applications', async (req, res, next) => {
  try {
    const { page = 1, pageSize = 10, status = 'pending' } = req.query;
    const offset = (page - 1) * pageSize;

    const applications = await query(
      `SELECT sm.*, ir.phone_brand, ir.phone_model, m.name as merchant_name
       FROM serial_modifications sm
       LEFT JOIN insurance_records ir ON sm.insurance_record_id = ir.id
       LEFT JOIN merchants m ON ir.merchant_id = m.id
       WHERE sm.status = ?
       ORDER BY sm.created_at DESC 
       LIMIT ? OFFSET ?`,
      [status, parseInt(pageSize), offset]
    );

    res.json({
      success: true,
      data: { applications }
    });
  } catch (error) {
    next(error);
  }
});

router.put('/serial-applications/:id/review', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, rejectReason } = req.body;

    const applications = await query(
      'SELECT * FROM serial_modifications WHERE id = ?',
      [id]
    );

    if (applications.length === 0) {
      return res.status(404).json({
        success: false,
        message: '串号修改申请不存在'
      });
    }

    const application = applications[0];

    if (action === 'approve') {
      await query(
        'UPDATE serial_modifications SET status = ?, reviewed_at = NOW() WHERE id = ?',
        ['approved', id]
      );

      await query(
        'UPDATE insurance_records SET serial_number = ? WHERE id = ?',
        [application.new_serial, application.insurance_record_id]
      );

      res.json({
        success: true,
        message: '串号修改已批准'
      });
    } else if (action === 'reject') {
      await query(
        'UPDATE serial_modifications SET status = ?, reject_reason = ?, reviewed_at = NOW() WHERE id = ?',
        ['rejected', rejectReason || '', id]
      );

      res.json({
        success: true,
        message: '串号修改已拒绝'
      });
    } else {
      return res.status(400).json({
        success: false,
        message: '无效的操作'
      });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
