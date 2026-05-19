const express = require('express');
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { calculateRemainingDays } = require('../utils/calculateDays');

const router = express.Router();

router.get('/merchant-records', authenticate, authorize('merchant'), async (req, res, next) => {
  try {
    const merchantId = req.user.merchant_id;

    const records = await query(
      `SELECT 
        ir.serial_number as '串号',
        ir.phone_brand as '手机品牌',
        ir.phone_model as '手机型号',
        ir.cost_amount as '购机金额',
        ir.insurance_amount as '保费金额',
        ir.start_time as '保险开始时间',
        ir.activation_time as '激活时间',
        CASE ir.is_activated WHEN 1 THEN '已激活' ELSE '未激活' END as '激活状态',
        CASE ir.sales_status 
          WHEN 'pending' THEN '待激活' 
          WHEN 'activated' THEN '已激活' 
          WHEN 'expired' THEN '已过期' 
          WHEN 'cancelled' THEN '已取消' 
        END as '销售状态',
        ir.remaining_days_calc as '剩余天数'
       FROM (
         SELECT ir.*, 
           CASE 
             WHEN ir.activation_time IS NOT NULL 
               THEN 365 - DATEDIFF(NOW(), ir.activation_time)
             WHEN ir.start_time IS NOT NULL 
               THEN 450 - DATEDIFF(NOW(), ir.start_time)
             ELSE 0 
           END as remaining_days_calc
         FROM insurance_records ir
         WHERE ir.merchant_id = ?
       ) ir
       ORDER BY ir.created_at DESC`,
      [merchantId]
    );

    const csvHeader = '串号,手机品牌,手机型号,购机金额,保费金额,保险开始时间,激活时间,激活状态,销售状态,剩余天数\n';
    
    const csvRows = records.map(record => {
      return [
        record['串号'] || '',
        record['手机品牌'] || '',
        record['手机型号'] || '',
        record['购机金额'] || '',
        record['保费金额'] || '',
        record['保险开始时间'] ? new Date(record['保险开始时间']).toLocaleString('zh-CN') : '',
        record['激活时间'] ? new Date(record['激活时间']).toLocaleString('zh-CN') : '',
        record['激活状态'] || '',
        record['销售状态'] || '',
        record['剩余天数'] || '0'
      ].join(',');
    }).join('\n');

    const csvContent = '\ufeff' + csvHeader + csvRows;

    const filename = `merchant_records_${merchantId}_${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(csvContent);
  } catch (error) {
    next(error);
  }
});

router.get('/insurance-records', authenticate, authorize('insurance'), async (req, res, next) => {
  try {
    const { merchantId = '', startDate = '', endDate = '' } = req.query;

    let whereClause = '';
    const params = [];

    if (merchantId) {
      whereClause = 'WHERE ir.merchant_id = ?';
      params.push(merchantId);
    }

    if (startDate && endDate) {
      whereClause += whereClause ? ' AND' : 'WHERE';
      whereClause += ' DATE(ir.start_time) BETWEEN ? AND ?';
      params.push(startDate, endDate);
    } else if (startDate) {
      whereClause += whereClause ? ' AND' : 'WHERE';
      whereClause += ' DATE(ir.start_time) >= ?';
      params.push(startDate);
    } else if (endDate) {
      whereClause += whereClause ? ' AND' : 'WHERE';
      whereClause += ' DATE(ir.start_time) <= ?';
      params.push(endDate);
    }

    const records = await query(
      `SELECT 
        ir.serial_number as '串号',
        ir.phone_brand as '手机品牌',
        ir.phone_model as '手机型号',
        m.name as '商家名称',
        ir.cost_amount as '购机金额',
        ir.insurance_amount as '保费金额',
        ir.start_time as '保险开始时间',
        ir.activation_time as '激活时间',
        CASE ir.is_activated WHEN 1 THEN '已激活' ELSE '未激活' END as '激活状态',
        CASE ir.sales_status 
          WHEN 'pending' THEN '待激活' 
          WHEN 'activated' THEN '已激活' 
          WHEN 'expired' THEN '已过期' 
          WHEN 'cancelled' THEN '已取消' 
        END as '销售状态',
        ir.remaining_days_calc as '剩余天数'
       FROM (
         SELECT ir.*, 
           CASE 
             WHEN ir.activation_time IS NOT NULL 
               THEN 365 - DATEDIFF(NOW(), ir.activation_time)
             WHEN ir.start_time IS NOT NULL 
               THEN 450 - DATEDIFF(NOW(), ir.start_time)
             ELSE 0 
           END as remaining_days_calc
         FROM insurance_records ir
       ) ir
       LEFT JOIN merchants m ON ir.merchant_id = m.id
       ${whereClause}
       ORDER BY ir.created_at DESC`,
      params
    );

    const csvHeader = '串号,手机品牌,手机型号,商家名称,购机金额,保费金额,保险开始时间,激活时间,激活状态,销售状态,剩余天数\n';
    
    const csvRows = records.map(record => {
      return [
        record['串号'] || '',
        record['手机品牌'] || '',
        record['手机型号'] || '',
        record['商家名称'] || '',
        record['购机金额'] || '',
        record['保费金额'] || '',
        record['保险开始时间'] ? new Date(record['保险开始时间']).toLocaleString('zh-CN') : '',
        record['激活时间'] ? new Date(record['激活时间']).toLocaleString('zh-CN') : '',
        record['激活状态'] || '',
        record['销售状态'] || '',
        record['剩余天数'] || '0'
      ].join(',');
    }).join('\n');

    const csvContent = '\ufeff' + csvHeader + csvRows;

    const filename = `insurance_records_${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(csvContent);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
