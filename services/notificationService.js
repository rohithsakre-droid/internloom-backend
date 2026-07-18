const Notification = require('../models/Notification');

async function notify(recipientType, recipientId, type, message) {
  return Notification.create({ recipientType, recipient: recipientId, type, message });
}

module.exports = { notify };
