-- 保险投保小程序 - 数据库初始化脚本
-- 用于插入初始测试数据

USE insurance_db;

-- 插入测试商家数据（密码都是 123456，使用bcrypt加密）
INSERT INTO merchants (name, phone, password, status) VALUES
('测试商家A', '13800138001', '$2a$10$X/vZ8KxM9Y.bZ7O5KxM9Y.bZ7O5KxM9Y.bZ7O5KxM9Y.bZ7O5KxM', 'active'),
('测试商家B', '13800138002', '$2a$10$X/vZ8KxM9Y.bZ7O5KxM9Y.bZ7O5KxM9Y.bZ7O5KxM9Y.bZ7O5KxM', 'inactive');

-- 插入测试保险方数据
INSERT INTO insurance_companies (name, contact_person, contact_phone) VALUES
('测试保险公司', '张三', '13800138888');

-- 插入测试用户数据（密码都是 123456）
INSERT INTO users (phone, password, role, merchant_id) VALUES
('13800138001', '$2a$10$X/vZ8KxM9Y.bZ7O5KxM9Y.bZ7O5KxM9Y.bZ7O5KxM9Y.bZ7O5KxM', 'merchant', 1),
('13800138002', '$2a$10$X/vZ8KxM9Y.bZ7O5KxM9Y.bZ7O5KxM9Y.bZ7O5KxM9Y.bZ7O5KxM', 'merchant', 2),
('13800138888', '$2a$10$X/vZ8KxM9Y.bZ7O5KxM9Y.bZ7O5KxM9Y.bZ7O5KxM9Y.bZ7O5KxM', 'insurance', NULL),
('13800138999', '$2a$10$X/vZ8KxM9Y.bZ7O5KxM9Y.bZ7O5KxM9Y.bZ7O5KxM9Y.bZ7O5KxM', 'customer', NULL);

-- 插入测试保险记录
INSERT INTO insurance_records (merchant_id, phone_brand, phone_model, serial_number, cost_amount, insurance_amount, cost_screenshot, start_time, is_activated, sales_status) VALUES
(1, '苹果', 'iPhone 15 Pro', '123456789012345', 8999.00, 299.00, '/uploads/test1.jpg', NOW(), 0, 'pending'),
(1, '华为', 'Mate 60 Pro', '987654321098765', 6999.00, 199.00, '/uploads/test2.jpg', NOW(), 1, 'activated'),
(2, '小米', '小米14 Pro', '567890123456789', 4999.00, 159.00, '/uploads/test3.jpg', NOW(), 0, 'pending');

-- 插入测试激活申请
INSERT INTO activation_applications (insurance_record_id, customer_phone, status, created_at) VALUES
(2, '13800138999', 'approved', NOW()),
(3, '13800138998', 'pending', NOW());

-- 插入测试串号修改申请
INSERT INTO serial_modifications (insurance_record_id, original_serial, new_serial, status, created_at) VALUES
(1, '123456789012345', '123456789012346', 'pending', NOW());
