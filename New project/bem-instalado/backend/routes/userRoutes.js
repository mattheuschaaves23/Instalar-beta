const express = require('express');
const controller = require('../controllers/userController');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/dashboard', auth, controller.getDashboard);
router.get('/profile', auth, controller.getProfile);
router.put('/profile', auth, controller.updateProfile);
router.get('/availability', auth, controller.getAvailabilitySlots);
router.post('/availability', auth, controller.createAvailabilitySlot);
router.delete('/availability/:id', auth, controller.deleteAvailabilitySlot);

module.exports = router;
