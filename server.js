const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');
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

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '服务器运行正常',
    timestamp: new Date().toISOString()
  });
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
