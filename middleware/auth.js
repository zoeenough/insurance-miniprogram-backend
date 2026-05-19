const jwt = require('jsonwebtoken');
const config = require('../config');
const { query } = require('../config/database');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: '未提供认证令牌'
      });
    }

    const token = authHeader.substring(7);

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt.secret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: '令牌已过期，请重新登录'
        });
      }
      return res.status(401).json({
        success: false,
        message: '无效的令牌'
      });
    }

    const { user_id, role } = decoded;

    const users = await query(
      'SELECT id, phone, role, merchant_id FROM users WHERE id = ?',
      [user_id]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: '用户不存在'
      });
    }

    const user = users[0];

    if (user.role === 'merchant' && !user.merchant_id) {
      return res.status(403).json({
        success: false,
        message: '商家未关联商家ID'
      });
    }

    req.user = user;
    req.userRole = role;
    next();
  } catch (error) {
    console.error('认证中间件错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '未认证'
      });
    }

    const userRole = req.user.role;

    const normalizedRoles = roles.map(role => {
      if (role === 'insurance_company') return 'insurance';
      return role;
    });

    if (!normalizedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: '权限不足，您需要以下角色之一: ' + roles.join(', ')
      });
    }
    next();
  };
}

function authorizeByRole(req, res, next) {
  const userRole = req.userRole || req.user.role;

  const rolePermissions = {
    merchant: ['merchant'],
    customer: ['customer'],
    insurance_company: ['insurance'],
    admin: ['merchant', 'customer', 'insurance']
  };

  const allowedRoles = rolePermissions[userRole] || [];

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: '权限不足'
    });
  }

  next();
}

module.exports = {
  authenticate,
  authorize,
  authorizeByRole
};
