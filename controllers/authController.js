const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const config = require('../config');

async function merchantLogin(phone, password) {
  const merchants = await query(
    'SELECT * FROM merchants WHERE phone = ? AND status = ?',
    [phone, 'active']
  );

  if (merchants.length === 0) {
    return {
      success: false,
      message: '商家不存在或账号未激活'
    };
  }

  const merchant = merchants[0];

  if (!merchant.password) {
    return {
      success: false,
      message: '商家未设置密码，请联系管理员'
    };
  }

  const isPasswordValid = await bcrypt.compare(password, merchant.password);

  if (!isPasswordValid) {
    return {
      success: false,
      message: '密码错误'
    };
  }

  let users = await query(
    'SELECT * FROM users WHERE phone = ? AND role = ?',
    [phone, 'merchant']
  );

  let userId;
  if (users.length === 0) {
    const result = await query(
      'INSERT INTO users (phone, password, role, merchant_id) VALUES (?, ?, ?, ?)',
      [phone, merchant.password, 'merchant', merchant.id]
    );
    userId = result.insertId;
  } else {
    userId = users[0].id;
  }

  const token = jwt.sign(
    {
      user_id: userId,
      phone: phone,
      role: 'merchant',
      merchant_id: merchant.id
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  return {
    success: true,
    message: '商家登录成功',
    token,
    userInfo: {
      user_id: userId,
      phone: phone,
      role: 'merchant',
      merchant_id: merchant.id,
      merchant_name: merchant.name,
      merchant_status: merchant.status
    }
  };
}

async function insuranceCompanyLogin(phone, password) {
  const insuranceCompanies = await query(
    'SELECT ic.*, u.id as user_id, u.password as user_password FROM insurance_companies ic LEFT JOIN users u ON u.phone = ic.contact_phone AND u.role = ? WHERE ic.contact_phone = ? AND ic.status = ?',
    ['insurance', phone, 'active']
  );

  if (insuranceCompanies.length === 0) {
    return {
      success: false,
      message: '保险方不存在或账号未激活'
    };
  }

  const insuranceCompany = insuranceCompanies[0];

  if (!insuranceCompany.user_password) {
    return {
      success: false,
      message: '保险方未设置密码，请联系管理员'
    };
  }

  const isPasswordValid = await bcrypt.compare(password, insuranceCompany.user_password);

  if (!isPasswordValid) {
    return {
      success: false,
      message: '密码错误'
    };
  }

  let users = await query(
    'SELECT * FROM users WHERE phone = ? AND role = ?',
    [phone, 'insurance']
  );

  let userId;
  if (users.length === 0) {
    const result = await query(
      'INSERT INTO users (phone, password, role) VALUES (?, ?, ?)',
      [phone, insuranceCompany.user_password, 'insurance']
    );
    userId = result.insertId;
  } else {
    userId = users[0].id;
  }

  await query(
    'UPDATE insurance_companies SET user_id = ? WHERE id = ?',
    [userId, insuranceCompany.id]
  );

  const token = jwt.sign(
    {
      user_id: userId,
      phone: phone,
      role: 'insurance_company',
      insurance_company_id: insuranceCompany.id
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  return {
    success: true,
    message: '保险方登录成功',
    token,
    userInfo: {
      user_id: userId,
      phone: phone,
      role: 'insurance_company',
      insurance_company_id: insuranceCompany.id,
      insurance_company_name: insuranceCompany.name,
      insurance_company_status: insuranceCompany.status
    }
  };
}

async function customerLogin(phone, password) {
  const users = await query(
    'SELECT * FROM users WHERE phone = ? AND role = ?',
    [phone, 'customer']
  );

  if (users.length === 0) {
    return {
      success: false,
      message: '顾客不存在'
    };
  }

  const user = users[0];

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    return {
      success: false,
      message: '密码错误'
    };
  }

  const token = jwt.sign(
    {
      user_id: user.id,
      phone: phone,
      role: 'customer'
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  return {
    success: true,
    message: '顾客登录成功',
    token,
    userInfo: {
      user_id: user.id,
      phone: phone,
      role: 'customer'
    }
  };
}

async function login(req, res, next) {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: '手机号和密码不能为空'
      });
    }

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: '手机号格式不正确'
      });
    }

    const merchants = await query(
      'SELECT * FROM merchants WHERE phone = ? AND status = ?',
      [phone, 'active']
    );

    if (merchants.length > 0) {
      const result = await merchantLogin(phone, password);
      return res.status(result.success ? 200 : 401).json(result);
    }

    const insuranceCompanies = await query(
      'SELECT ic.*, u.id as user_id, u.password as user_password FROM insurance_companies ic LEFT JOIN users u ON u.phone = ic.contact_phone AND u.role = ? WHERE ic.contact_phone = ? AND ic.status = ?',
      ['insurance', phone, 'active']
    );

    if (insuranceCompanies.length > 0) {
      const result = await insuranceCompanyLogin(phone, password);
      return res.status(result.success ? 200 : 401).json(result);
    }

    const customers = await query(
      'SELECT * FROM users WHERE phone = ? AND role = ?',
      [phone, 'customer']
    );

    if (customers.length > 0) {
      const result = await customerLogin(phone, password);
      return res.status(result.success ? 200 : 401).json(result);
    }

    return res.status(401).json({
      success: false,
      message: '用户不存在'
    });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res) {
  res.json({
    success: true,
    message: '退出登录成功'
  });
}

async function getUserInfo(req, res, next) {
  try {
    const user = req.user;

    let userInfo = {
      user_id: user.id,
      phone: user.phone,
      role: user.role
    };

    if (user.role === 'merchant' && user.merchant_id) {
      const merchants = await query(
        'SELECT * FROM merchants WHERE id = ?',
        [user.merchant_id]
      );
      if (merchants.length > 0) {
        userInfo.merchant = {
          id: merchants[0].id,
          name: merchants[0].name,
          status: merchants[0].status,
          contact_person: merchants[0].contact_person,
          address: merchants[0].address
        };
      }
    }

    if (user.role === 'insurance') {
      const insuranceCompanies = await query(
        'SELECT * FROM insurance_companies WHERE user_id = ?',
        [user.id]
      );
      if (insuranceCompanies.length > 0) {
        userInfo.insurance_company = {
          id: insuranceCompanies[0].id,
          name: insuranceCompanies[0].name,
          status: insuranceCompanies[0].status,
          contact_person: insuranceCompanies[0].contact_person,
          address: insuranceCompanies[0].address
        };
      }
    }

    res.json({
      success: true,
      data: userInfo
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
  logout,
  getUserInfo
};
