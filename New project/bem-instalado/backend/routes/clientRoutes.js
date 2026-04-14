const express = require('express');
const controller = require('../controllers/clientController');
const auth = require('../middleware/authMiddleware');
const hasSubscription = require('../middleware/subscriptionMiddleware');

const router = express.Router();

router.use(auth);
router.use(hasSubscription);

router.post('/', controller.createClient);
router.get('/', controller.getClients);
router.get('/:id', controller.getClient);
router.put('/:id', controller.updateClient);
router.delete('/:id', controller.deleteClient);

module.exports = router;
