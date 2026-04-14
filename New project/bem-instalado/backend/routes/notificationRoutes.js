const express = require('express');
const controller = require('../controllers/notificationController');
const auth = require('../middleware/authMiddleware');
const hasSubscription = require('../middleware/subscriptionMiddleware');

const router = express.Router();

router.use(auth);
router.use(hasSubscription);

router.get('/', controller.getNotifications);
router.put('/:id/read', controller.markAsRead);

module.exports = router;
