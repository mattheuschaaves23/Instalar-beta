module.exports = (phone, message) => {
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
};
