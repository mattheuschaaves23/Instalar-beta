const express = require('express');
const supportController = require('../controllers/supportController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/me', supportController.getMyConversation);
router.post('/messages', supportController.sendMessage);
router.post('/me/read', supportController.markMyConversationAsRead);
router.get('/ideas/me', supportController.getMyIdeas);
router.post('/ideas', supportController.createIdea);

router.get('/admin/conversations', adminMiddleware, supportController.getAdminConversations);
router.get('/admin/conversations/:conversationId/messages', adminMiddleware, supportController.getAdminConversationMessages);
router.post('/admin/conversations/:conversationId/read', adminMiddleware, supportController.markAdminConversationAsRead);
router.patch('/admin/conversations/:conversationId/status', adminMiddleware, supportController.updateConversationStatus);
router.get('/admin/ideas', adminMiddleware, supportController.getAdminIdeas);
router.patch('/admin/ideas/:ideaId', adminMiddleware, supportController.updateIdea);

module.exports = router;
