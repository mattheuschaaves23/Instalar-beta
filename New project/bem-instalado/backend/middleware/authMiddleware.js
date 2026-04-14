const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');

module.exports = (req, res, next) => {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ error: 'Token nao informado.' });
  }

  const [scheme, token] = header.split(' ');

  if (!/^Bearer$/i.test(scheme) || !token) {
    return res.status(401).json({ error: 'Token mal formatado.' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.userId = decoded.id;
    return next();
  } catch (_error) {
    return res.status(401).json({ error: 'Token invalido.' });
  }
};
