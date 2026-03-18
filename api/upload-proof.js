import { getDbInstance, ref, update } from './utils/db.js';
import { sendEmailJS } from './orders.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { orderId, base64Str, order } = body;

    const db = getDbInstance();
    await update(ref(db, `orders/${orderId}`), { proofOfPayment: base64Str });

    // Send admin notification
    if (order) {
      sendEmailJS(process.env.EMAILJS_ADMIN_TEMPLATE_ID, {
        title: 'Proof Uploaded: ' + order.id,
        message: `${order.name} uploaded proof of payment for ${order.payment} (${CONFIG.currency}${order.total})`
      }).catch(console.error);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed' });
  }
}
