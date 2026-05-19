function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  if (err.type === 'validation') {
    return res.status(400).json({
      success: false,
      message: '数据验证失败',
      errors: err.errors
    });
  }

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: '文件大小超过限制'
      });
    }
    return res.status(400).json({
      success: false,
      message: '文件上传失败'
    });
  }

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: '数据已存在'
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || '服务器内部错误'
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: '路由不存在'
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
