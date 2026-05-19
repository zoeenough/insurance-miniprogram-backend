const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const merchantController = require('../controllers/merchantController');

const router = express.Router();

router.use(authenticate);
router.use(authorize('insurance_company', 'admin'));

router.get('/merchants', merchantController.getMerchants);

router.post('/merchants', merchantController.createMerchant);

router.put('/merchants/:id', merchantController.updateMerchant);

router.put('/merchants/:id/status', merchantController.updateMerchantStatus);

module.exports = router;
