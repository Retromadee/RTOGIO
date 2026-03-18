/* ═══════════════════════════════════════════════════════════════
   FRAMES — Notifications (Email + WhatsApp)
   ═══════════════════════════════════════════════════════════════ */

// ── EMAILJS INIT ──────────────────────────────────────────────────────────────
// Now completely handled server-side

function initEmailJS() {
  // no-op
}

async function sendOrderConfirmationEmail(order) {
  // Handled by backend `/api/orders` POST
}

async function sendStatusUpdateEmail(order, statusObj) {
  // Handled by `/api/email` POST in admin.js
}

async function sendAdminProofEmail(order) {
  // Handled by backend `/api/upload-proof` POST
}

// ── WHATSAPP ──────────────────────────────────────────────────────────────────

/**
 * Generate a wa.me link to message a customer.
 * phone: customer's phone (any format — we strip non-digits)
 * message: pre-filled message text
 */
function generateWhatsAppLink(phone, message) {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * Build the standard "order placed" WhatsApp message.
 */
function buildOrderPlacedWhatsApp(order) {
  return (
    `Hi ${order.name}! 👋\n\n` +
    `Thank you for your order at ${CONFIG.brandName}.\n\n` +
    `📋 *Order ID:* ${order.id}\n` +
    `🕶️ *Product:* ${order.productName}\n` +
    `📦 *Quantity:* ${order.qty}\n` +
    `💰 *Total:* ${CONFIG.currency}${order.total.toLocaleString()}\n` +
    `💳 *Payment:* ${order.payment}\n` +
    `📍 *Delivery:* ${order.location}\n\n` +
    `*ACTION REQUIRED:* If you chose Bank Transfer or Crypto, please *send a screenshot of your receipt/transfer* to this number.\n\n` +
    `We will keep you updated on your package status. Thank you! 🙏`
  );
}

/**
 * Build a status-update WhatsApp message.
 */
function buildStatusUpdateWhatsApp(order, statusObj) {
  const messages = {
    processing: `Hi ${order.name}! Your ${CONFIG.brandName} package (${order.id}) is now being processed — your frames are being prepared. We'll notify you when they're ready! 🕶️`,
    ready:      `Hi ${order.name}! Great news — your ${CONFIG.brandName} package (${order.id}) is *READY*! We'll contact you shortly to arrange delivery. Can't wait? Reply here! ✨`,
    ontheway:   `Hi ${order.name}! Your ${CONFIG.brandName} package (${order.id}) is now *on the way*! 🚚 Expect delivery soon. Please be available at: ${order.location}.`,
    delivered:  `Hi ${order.name}! Your ${CONFIG.brandName} package (${order.id}) has been *DELIVERED*! ✅ We hope you love your new frames. Thank you for choosing ${CONFIG.brandName}! 🙏`,
  };
  return messages[statusObj.key] ||
    `Hi ${order.name}! Update on your ${CONFIG.brandName} package (${order.id}): *${statusObj.title}* — ${statusObj.desc}`;
}
