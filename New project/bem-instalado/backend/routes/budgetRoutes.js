const express = require('express');
const controller = require('../controllers/budgetController');
const auth = require('../middleware/authMiddleware');
const hasSubscription = require('../middleware/subscriptionMiddleware');

const router = express.Router();

router.use(auth);
router.use(hasSubscription);

router.post('/', controller.createBudget);
router.get('/', controller.getBudgets);
router.get('/:id', controller.getBudget);
router.put('/:id/approve', controller.approveBudget);
router.put('/:id/reject', controller.rejectBudget);
router.get('/:id/pdf', controller.generatePDF);
router.get('/:id/whatsapp', controller.sendWhatsApp);

module.exports = router;
