import { getDbInstance, ref, get, set, update, child } from './utils/db.js';
import { verifyAuth } from './utils/auth.js';

async function sendEmailJS(templateId, params) {
  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: process.env.EMAILJS_SERVICE_ID,
      template_id: templateId,
      user_id: process.env.EMAILJS_PUBLIC_KEY,
      template_params: params
    })
  });
  
  if (!response.ok) {
    const err = await response.text();
    console.error('EmailJS Error:', err);
    throw new Error('Failed to send email: ' + err);
  }
}

export default async function handler(req, res) {
  // Prevent Vercel caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const db = getDbInstance();

  if (req.method === 'GET') {
    // Admin only
    if (!verifyAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const snap = await get(ref(db, 'orders'));
      if (snap.exists()) {
        const data = snap.val();
        return res.status(200).json(Object.values(data));
      }
      return res.status(200).json([]);
    } catch (err) {
      return res.status(500).json({ error: 'Failed' });
    }
  }

  if (req.method === 'POST') {
    // Public: Create order
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const order = body;
      order.createdAt = new Date().toISOString();

      // Decrement stock
      const stockRef = ref(db, `inventory/${order.productId}/stock`);
      const snap = await get(stockRef);
      const current = snap.val() || 0;
      const newStock = Math.max(0, current - order.qty);
      await set(stockRef, newStock);

      // Save order
      await set(ref(db, `orders/${order.id}`), order);

      // Send email
      const templateParams = {
        to_name: order.name,
        to_email: order.email,
        order_id: order.id,
        product_name: order.productName,
        qty: order.qty,
        total: `£${order.total}`,
        payment: order.payment,
        location: order.deliveryMethod === 'kofali' ? 'Kofali Homes' : 'Couture Dorms'
      };

      try {
        await sendEmailJS(process.env.EMAILJS_ORDER_TEMPLATE_ID, templateParams);
        // Also notify admin
        await sendEmailJS(process.env.EMAILJS_ADMIN_TEMPLATE_ID, {
          title: 'New Order: ' + order.id,
          message: `${order.name} ordered ${order.qty}x ${order.productName} for £${order.total} (${order.payment})`
        });
      } catch (e) {
        console.error('Email warning:', e);
        // We still return success for the order
      }

      return res.status(200).json({ success: true, newStock });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to process order' });
    }
  }

  if (req.method === 'PUT') {
    // Admin only: Update status
    if (!verifyAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { id, updates } = body;
      
      updates.updatedAt = new Date().toISOString();
      await update(ref(db, `orders/${id}`), updates);
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: 'Failed' });
    }
  }
}

export { sendEmailJS };
