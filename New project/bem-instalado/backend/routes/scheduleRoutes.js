const express = require('express');
const controller = require('../controllers/scheduleController');
const auth = require('../middleware/authMiddleware');
const hasSubscription = require('../middleware/subscriptionMiddleware');

const router = express.Router();

router.use(auth);
router.use(hasSubscription);

router.get('/', controller.getSchedules);
router.put('/:id/status', controller.updateScheduleStatus);
router.delete('/:id', controller.deleteSchedule);

module.exports = router;
