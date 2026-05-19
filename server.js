const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { query, getConnection } = require('./config/database');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const merchantRoutes = require('./routes/merchant');
const insuranceRoutes = require('./routes/insurance');
const customerRoutes = require('./routes/customer');
const adminRoutes = require('./routes/admin');
const adminMerchantRoutes = require('./routes/adminMerchant');
const exportRoutes = require('./routes/export');

const app = express();

app.use(cors({
  origin: config.allowedOrigins,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadPath = path.resolve(config.upload.path);
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}
app.use('/uploads', express.static(uploadPath));

app.get('/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({
      success: true,
      message: '服务器和数据库连接正常',
      timestamp: new Date().toISOString(),
      dbConfig: {
        host: config.db.host,
        port: config.db.port,
        database: config.db.database
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '数据库连接失败',
      error: error.message,
      dbConfig: {
        host: config.db.host,
        port: config.db.port,
        database: config.db.database
      }
    });
  }
});

app.get('/api/init-db', async (req, res) => {
  try {
    console.log('开始初始化数据库...');
    console.log('数据库配置:', {
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      database: config.db.database
    });
    
    const schemaPath = path.join(__dirname, './database/schema.sql');
    const initDataPath = path.join(__dirname, './database/init_data.sql');
    
    let schemaSql = fs.readFileSync(schemaPath, 'utf8');
    let initDataSql = fs.readFileSync(initDataPath, 'utf8');
    
    // 移除注释
    schemaSql = schemaSql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    initDataSql = initDataSql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    
    const connection = await getConnection();
    
    console.log('执行schema...');
    const statements = schemaSql.split(';').filter(s => s.trim());
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (stmt && !stmt.startsWith('--')) {
        try {
          await connection.execute(stmt);
          console.log(`执行成功 (${i + 1}/${statements.length})`);
        } catch (e) {
          console.log(`跳过语句 (可能已存在): ${e.message}`);
        }
      }
    }
    
    console.log('执行初始数据...');
    const initStatements = initDataSql.split(';').filter(s => s.trim());
    for (let i = 0; i < initStatements.length; i++) {
      const stmt = initStatements[i].trim();
      if (stmt && !stmt.startsWith('--')) {
        try {
          await connection.execute(stmt);
          console.log(`初始数据执行成功 (${i + 1}/${initStatements.length})`);
        } catch (e) {
          console.log(`跳过初始数据: ${e.message}`);
        }
      }
    }
    
    connection.release();
    
    res.json({
      success: true,
      message: '数据库初始化完成'
    });
  } catch (error) {
    console.error('数据库初始化失败:', error);
    res.status(500).json({
      success: false,
      message: '数据库初始化失败',
      error: error.message,
      stack: error.stack
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminMerchantRoutes);
app.use('/api/export', exportRoutes);

app.use(notFoundHandler);

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`服务器已启动，监听端口 ${config.port}`);
  console.log(`环境: ${config.nodeEnv}`);
  console.log(`数据库: ${config.db.database}@${config.db.host}:${config.db.port}`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  process.exit(1);
});

module.exports = app;
