const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const xlsx = require('xlsx');
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { calculateRemainingDays } = require('../utils/calculateDays');
const config = require('../config');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.upload.path);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxFileSize }
});

router.post('/upload-screenshot', authenticate, authorize('merchant'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '未上传文件'
      });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    res.json({
      success: true,
      url: fileUrl
    });
  } catch (error) {
    next(error);
  }
});

router.get('/records', authenticate, authorize('merchant'), async (req, res, next) => {
  try {
    const { page = 1, pageSize = 10 } = req.query;
    const merchantId = parseInt(req.user.merchant_id);
    const pageNum = parseInt(page);
    const size = parseInt(pageSize);
    const offset = (pageNum - 1) * size;

    const records = await query(
      `SELECT * FROM insurance_records 
       WHERE merchant_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [merchantId, size, offset]
    );

    const recordsWithDays = records.map(record => ({
      ...record,
      remaining_days: calculateRemainingDays(record.start_time, record.activation_time)
    }));

    const countResult = await query(
      `SELECT COUNT(*) as total FROM insurance_records WHERE merchant_id = ?`,
      [merchantId]
    );

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

router.post('/records', authenticate, authorize('merchant'), async (req, res, next) => {
  try {
    const { phoneBrand, phoneModel, serialNumber, costAmount, insuranceAmount, costScreenshot } = req.body;
    const merchantId = req.user.merchant_id;

    if (!merchantId) {
      return res.status(400).json({
        success: false,
        message: '商家信息不完整'
      });
    }

    if (!serialNumber || !/^\d{11}$/.test(serialNumber)) {
      return res.status(400).json({
        success: false,
        message: '手机串码必须为11位数字'
      });
    }

    const existingRecord = await query(
      'SELECT id FROM insurance_records WHERE serial_number = ?',
      [serialNumber]
    );

    if (existingRecord.length > 0) {
      return res.status(400).json({
        success: false,
        message: '该串号已存在'
      });
    }

    const insuranceAmountMap = {
      '0-999': 99,
      '1000-1999': 199,
      '2000-2999': 299,
      '3000-4999': 399,
      '5000+': 599
    };

    let matchedInsuranceAmount = insuranceAmount;
    if (!insuranceAmount) {
      const cost = parseFloat(costAmount);
      if (cost < 1000) {
        matchedInsuranceAmount = insuranceAmountMap['0-999'];
      } else if (cost < 2000) {
        matchedInsuranceAmount = insuranceAmountMap['1000-1999'];
      } else if (cost < 3000) {
        matchedInsuranceAmount = insuranceAmountMap['2000-2999'];
      } else if (cost < 5000) {
        matchedInsuranceAmount = insuranceAmountMap['3000-4999'];
      } else {
        matchedInsuranceAmount = insuranceAmountMap['5000+'];
      }
    }

    const result = await query(
      `INSERT INTO insurance_records 
       (merchant_id, phone_brand, phone_model, serial_number, cost_amount, insurance_amount, cost_screenshot, start_time, is_activated, sales_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 0, 'pending')`,
      [merchantId, phoneBrand, phoneModel, serialNumber, costAmount, matchedInsuranceAmount, costScreenshot]
    );

    res.status(201).json({
      success: true,
      message: '手机信息上传成功',
      data: { id: result.insertId }
    });
  } catch (error) {
    next(error);
  }
});

router.put('/records/:id/sales-status', authenticate, authorize('merchant'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { salesStatus } = req.body;
    const merchantId = req.user.merchant_id;

    const records = await query(
      'SELECT * FROM insurance_records WHERE id = ? AND merchant_id = ?',
      [id, merchantId]
    );

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: '保险记录不存在'
      });
    }

    await query(
      'UPDATE insurance_records SET sales_status = ? WHERE id = ?',
      [salesStatus, id]
    );

    res.json({
      success: true,
      message: '销售状态已更新'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/records/:id/modify-serial', authenticate, authorize('merchant'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newSerialNumber } = req.body;
    const merchantId = req.user.merchant_id;

    if (!newSerialNumber || !/^\d{11}$/.test(newSerialNumber)) {
      return res.status(400).json({
        success: false,
        message: '新串号必须为11位数字'
      });
    }

    const records = await query(
      'SELECT * FROM insurance_records WHERE id = ? AND merchant_id = ?',
      [id, merchantId]
    );

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: '保险记录不存在'
      });
    }

    const originalSerial = records[0].serial_number;

    const existingModification = await query(
      'SELECT id FROM serial_modifications WHERE insurance_record_id = ? AND status = ?',
      [id, 'pending']
    );

    if (existingModification.length > 0) {
      return res.status(400).json({
        success: false,
        message: '该记录已有待审批的串号修改申请'
      });
    }

    const result = await query(
      `INSERT INTO serial_modifications (insurance_record_id, original_serial, new_serial, status)
       VALUES (?, ?, ?, 'pending')`,
      [id, originalSerial, newSerialNumber]
    );

    res.status(201).json({
      success: true,
      message: '串号修改申请已提交',
      data: { id: result.insertId }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/modify-applications', authenticate, authorize('merchant'), async (req, res, next) => {
  try {
    const { page = 1, pageSize = 10 } = req.query;
    const merchantId = req.user.merchant_id;
    const pageNum = parseInt(page);
    const size = parseInt(pageSize);
    const offset = (pageNum - 1) * size;

    const applications = await query(
      `SELECT sm.*, ir.phone_brand, ir.phone_model, ir.serial_number
       FROM serial_modifications sm
       LEFT JOIN insurance_records ir ON sm.insurance_record_id = ir.id
       WHERE ir.merchant_id = ?
       ORDER BY sm.created_at DESC 
       LIMIT ? OFFSET ?`,
      [merchantId, size, offset]
    );

    const applicationsWithStatus = applications.map(app => {
      let statusText = '';
      switch(app.status) {
        case 'pending':
          statusText = '待审批';
          break;
        case 'approved':
          statusText = '已通过';
          break;
        case 'rejected':
          statusText = '已拒绝';
          break;
        default:
          statusText = app.status;
      }
      return {
        ...app,
        status_text: statusText
      };
    });

    const countResult = await query(
      `SELECT COUNT(*) as total 
       FROM serial_modifications sm
       LEFT JOIN insurance_records ir ON sm.insurance_record_id = ir.id
       WHERE ir.merchant_id = ?`,
      [merchantId]
    );

    res.json({
      success: true,
      data: {
        applications: applicationsWithStatus,
        total: countResult[0].total
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/info', authenticate, authorize('merchant'), async (req, res, next) => {
  try {
    const merchantId = req.user.merchant_id;

    const merchants = await query(
      'SELECT * FROM merchants WHERE id = ?',
      [merchantId]
    );

    if (merchants.length === 0) {
      return res.status(404).json({
        success: false,
        message: '商家不存在'
      });
    }

    const statsResult = await query(
      `SELECT 
        COUNT(*) as totalRecords,
        SUM(CASE WHEN sales_status = 'pending' THEN 1 ELSE 0 END) as pendingActivations,
        SUM(CASE WHEN sales_status = 'activated' THEN 1 ELSE 0 END) as activeInsurances,
        SUM(CASE WHEN DATE_FORMAT(start_time, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m') THEN insurance_amount ELSE 0 END) as monthlyRevenue
       FROM insurance_records WHERE merchant_id = ?`,
      [merchantId]
    );

    res.json({
      success: true,
      data: {
        merchant: merchants[0],
        stats: statsResult[0]
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/batch-upload', authenticate, authorize('merchant'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '未上传文件'
      });
    }

    const allowedExtensions = ['.xlsx', '.xls'];
    const ext = path.extname(req.file.originalname).toLowerCase();
    
    if (!allowedExtensions.includes(ext)) {
      return res.status(400).json({
        success: false,
        message: '只支持Excel文件格式(.xlsx, .xls)'
      });
    }

    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Excel文件中没有数据'
      });
    }

    const merchantId = parseInt(req.user.merchant_id);
    const results = {
      success: [],
      failed: [],
      duplicates: []
    };

    const insuranceAmountMap = {
      '0-999': 99,
      '1000-1999': 199,
      '2000-2999': 299,
      '3000-4999': 399,
      '5000+': 599
    };

    for (const row of data) {
      const phoneBrand = row['手机品牌'] || row['品牌'] || '';
      const phoneModel = row['手机型号'] || row['型号'] || '';
      const serialNumber = row['串号'] || row['IMEI'] || row['手机串号'] || '';
      const costAmount = row['成本金额'] || row['金额'] || row['购机金额'] || '';

      if (!phoneBrand || !phoneModel || !serialNumber || !costAmount) {
        results.failed.push({
          row: row,
          reason: '缺少必填字段（手机品牌、型号、串号、成本金额）'
        });
        continue;
      }

      if (!/^\d{11}$/.test(String(serialNumber).trim())) {
        results.failed.push({
          row: row,
          reason: `串号格式不正确，必须为11位数字，当前值: ${serialNumber}`
        });
        continue;
      }

      const existingRecord = await query(
        'SELECT id FROM insurance_records WHERE serial_number = ?',
        [String(serialNumber).trim()]
      );

      if (existingRecord.length > 0) {
        results.duplicates.push({
          row: row,
          serialNumber: String(serialNumber).trim()
        });
        continue;
      }

      const cost = parseFloat(costAmount);
      let insuranceAmount = 0;
      if (cost < 1000) {
        insuranceAmount = insuranceAmountMap['0-999'];
      } else if (cost < 2000) {
        insuranceAmount = insuranceAmountMap['1000-1999'];
      } else if (cost < 3000) {
        insuranceAmount = insuranceAmountMap['2000-2999'];
      } else if (cost < 5000) {
        insuranceAmount = insuranceAmountMap['3000-4999'];
      } else {
        insuranceAmount = insuranceAmountMap['5000+'];
      }

      try {
        const result = await query(
          `INSERT INTO insurance_records 
           (merchant_id, phone_brand, phone_model, serial_number, cost_amount, insurance_amount, start_time, is_activated, sales_status)
           VALUES (?, ?, ?, ?, ?, ?, NOW(), 0, 'pending')`,
          [merchantId, phoneBrand, phoneModel, String(serialNumber).trim(), cost, insuranceAmount]
        );

        results.success.push({
          id: result.insertId,
          serialNumber: String(serialNumber).trim(),
          phoneBrand,
          phoneModel,
          costAmount: cost,
          insuranceAmount
        });
      } catch (error) {
        results.failed.push({
          row: row,
          reason: `数据库插入失败: ${error.message}`
        });
      }
    }

    res.json({
      success: true,
      message: `批量上传完成，成功: ${results.success.length}条，失败: ${results.failed.length}条，重复: ${results.duplicates.length}条`,
      data: results
    });
  } catch (error) {
    console.error('批量上传错误:', error);
    next(error);
  }
});

module.exports = router;
