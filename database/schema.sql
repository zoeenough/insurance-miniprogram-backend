-- 保险投保小程序数据库表结构

-- 用户表
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `phone` VARCHAR(20) NOT NULL COMMENT '手机号',
  `password` VARCHAR(255) NOT NULL COMMENT '密码（加密存储）',
  `role` ENUM('merchant', 'customer', 'insurance') NOT NULL COMMENT '用户角色：商家/顾客/保险方',
  `merchant_id` INT UNSIGNED DEFAULT NULL COMMENT '关联商家ID（仅商家角色）',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_phone_role` (`phone`, `role`),
  KEY `idx_merchant_id` (`merchant_id`),
  KEY `idx_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 商家表
CREATE TABLE IF NOT EXISTS `merchants` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '商家ID',
  `name` VARCHAR(100) NOT NULL COMMENT '商家名称',
  `phone` VARCHAR(20) NOT NULL COMMENT '商家电话',
  `password` VARCHAR(255) DEFAULT NULL COMMENT '商家登录密码',
  `status` ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态: active=启用, inactive=禁用',
  `contact_person` VARCHAR(50) DEFAULT NULL COMMENT '联系人',
  `address` VARCHAR(255) DEFAULT NULL COMMENT '商家地址',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_phone` (`phone`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商家表';

-- 保险方表
CREATE TABLE IF NOT EXISTS `insurance_companies` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '保险方ID',
  `user_id` INT UNSIGNED DEFAULT NULL COMMENT '关联用户ID',
  `name` VARCHAR(200) NOT NULL COMMENT '保险公司名称',
  `license_no` VARCHAR(50) DEFAULT NULL COMMENT '营业执照号',
  `contact_person` VARCHAR(50) DEFAULT NULL COMMENT '联系人',
  `contact_phone` VARCHAR(20) DEFAULT NULL COMMENT '联系电话',
  `address` VARCHAR(255) DEFAULT NULL COMMENT '公司地址',
  `status` ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='保险方表';

-- 保险记录表
CREATE TABLE IF NOT EXISTS `insurance_records` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  `merchant_id` INT UNSIGNED NOT NULL COMMENT '商家ID',
  `phone_brand` VARCHAR(50) NOT NULL COMMENT '手机品牌',
  `phone_model` VARCHAR(100) NOT NULL COMMENT '手机型号',
  `serial_number` VARCHAR(50) NOT NULL COMMENT '串号（IMEI）',
  `cost_amount` DECIMAL(10,2) NOT NULL COMMENT '购机金额',
  `insurance_amount` DECIMAL(10,2) NOT NULL COMMENT '保费金额',
  `cost_screenshot` VARCHAR(255) DEFAULT NULL COMMENT '购机凭证截图',
  `start_time` DATETIME DEFAULT NULL COMMENT '保险开始时间',
  `activation_time` DATETIME DEFAULT NULL COMMENT '激活时间',
  `is_activated` TINYINT(1) DEFAULT 0 COMMENT '是否已激活：0-否，1-是',
  `sales_status` ENUM('pending', 'activated', 'expired', 'cancelled') DEFAULT 'pending' COMMENT '销售状态',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_serial_number` (`serial_number`),
  KEY `idx_merchant_id` (`merchant_id`),
  KEY `idx_sales_status` (`sales_status`),
  KEY `idx_is_activated` (`is_activated`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='保险记录表';

-- 激活申请审核表
CREATE TABLE IF NOT EXISTS `activation_applications` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '申请ID',
  `insurance_record_id` INT UNSIGNED NOT NULL COMMENT '保险记录ID',
  `customer_phone` VARCHAR(20) NOT NULL COMMENT '顾客手机号',
  `status` ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT '审核状态',
  `reject_reason` VARCHAR(255) DEFAULT NULL COMMENT '拒绝原因',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '申请时间',
  `reviewed_at` DATETIME DEFAULT NULL COMMENT '审核时间',
  PRIMARY KEY (`id`),
  KEY `idx_insurance_record_id` (`insurance_record_id`),
  KEY `idx_customer_phone` (`customer_phone`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='激活申请审核表';

-- 串号修改申请审核表
CREATE TABLE IF NOT EXISTS `serial_modifications` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '申请ID',
  `insurance_record_id` INT UNSIGNED NOT NULL COMMENT '保险记录ID',
  `original_serial` VARCHAR(50) NOT NULL COMMENT '原串号',
  `new_serial` VARCHAR(50) NOT NULL COMMENT '新串号',
  `status` ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT '审批状态',
  `reject_reason` VARCHAR(255) DEFAULT NULL COMMENT '拒绝原因',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '申请时间',
  `reviewed_at` DATETIME DEFAULT NULL COMMENT '审批时间',
  PRIMARY KEY (`id`),
  KEY `idx_insurance_record_id` (`insurance_record_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='串号修改申请审核表';

-- 操作日志表（可选，用于审计）
CREATE TABLE IF NOT EXISTS `operation_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  `user_id` INT UNSIGNED DEFAULT NULL COMMENT '操作用户ID',
  `user_role` VARCHAR(20) DEFAULT NULL COMMENT '用户角色',
  `action` VARCHAR(50) NOT NULL COMMENT '操作类型',
  `target_type` VARCHAR(50) DEFAULT NULL COMMENT '操作对象类型',
  `target_id` INT UNSIGNED DEFAULT NULL COMMENT '操作对象ID',
  `detail` TEXT DEFAULT NULL COMMENT '操作详情',
  `ip_address` VARCHAR(50) DEFAULT NULL COMMENT 'IP地址',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_action` (`action`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='操作日志表';
