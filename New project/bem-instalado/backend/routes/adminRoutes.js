const express = require('express');
const controller = require('../controllers/adminController');
const auth = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware');
const adminAudit = require('../middleware/adminAuditMiddleware');

const router = express.Router();

router.use(auth);
router.use(admin);
router.use(adminAudit);

router.get('/overview', controller.getOverview);
router.get('/users', controller.listUsers);
router.get('/payments', controller.listPayments);
router.get('/recommended-stores', controller.listRecommendedStores);
router.post('/announcements', controller.broadcastAnnouncement);
router.post('/recommended-stores', controller.createRecommendedStore);
router.patch('/users/:id/subscription', controller.updateUserSubscription);
router.patch('/users/:id/public-profile', controller.updateUserPublicProfile);
router.patch('/users/:id/trust', controller.updateUserTrust);
router.patch('/users/:id/admin', controller.updateUserAdmin);
router.patch('/recommended-stores/:id', controller.updateRecommendedStore);
router.delete('/users/:id', controller.deleteUser);
router.delete('/recommended-stores/:id', controller.deleteRecommendedStore);
router.patch('/payments/:id/status', controller.updatePaymentStatus);

module.exports = router;
