require('dotenv').config();

const parseDBUrl = (url) => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port,
      user: parsed.username,
      password: parsed.password,
      database: parsed.pathname.replace('/', '')
    };
  } catch (e) {
    return null;
  }
};

const dbFromUrl = parseDBUrl(process.env.MYSQL_URL || process.env.DATABASE_URL);

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  db: dbFromUrl || {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'insurance_db',
    charset: process.env.DB_CHARSET || 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'default_secret_key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },

  upload: {
    path: process.env.UPLOAD_PATH || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024
  },

  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:8080').split(',')
};
