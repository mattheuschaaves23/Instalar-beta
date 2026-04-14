const express = require('express');
const controller = require('../controllers/subscriptionController');
const auth = require('../middleware/authMiddleware');
const { createRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

const webhookLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 250,
  keyGenerator: (req) => `mp:${req.body?.data?.id || req.query['data.id'] || req.query.id || req.ip || 'unknown'}`,
  message: 'Webhook limitado temporariamente por excesso de requisições.',
});

const paymentCreationLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 8,
  message: 'Muitas tentativas de gerar pagamento. Aguarde alguns minutos.',
});

router.post('/webhook/mercadopago', webhookLimiter, controller.handleMercadoPagoWebhook);

router.use(auth);
router.get('/', controller.getSubscription);
router.post('/pay', paymentCreationLimiter, controller.createPayment);
router.get('/payment/:externalId', controller.checkPayment);
router.post('/payment/:externalId/confirm', controller.confirmPayment);

module.exports = router;

