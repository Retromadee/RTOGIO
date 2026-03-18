import { getDbInstance, ref, get, set, update, child } from './utils/db.js';
import { verifyAuth } from './utils/auth.js';

async function sendEmailJS(templateId, params) {
  console.log(`[EmailJS] Sending template ${templateId} to ${params.to_email || 'Admin'}`);
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
      console.log(`[Order API] Processing order ${order.id} for ${order.email}`);
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
        // 1. Send to User
        await sendEmailJS(process.env.EMAILJS_ORDER_TEMPLATE_ID, templateParams);
        
        // 2. Send to Admin (Detailed)
        await sendEmailJS(process.env.EMAILJS_ADMIN_TEMPLATE_ID, {
          title: 'NEW ORDER: ' + order.id,
          message: `
            NEW ORDER: ${order.id}
            
            Customer: ${order.name}
            Item: ${order.productName} (x${order.qty})
            Total: £${order.total}
            Phone: ${order.phone}
            Email: ${order.email}
            Location: ${order.location}
            Payment: ${order.payment}
            
            Contact Customer via WhatsApp: https://wa.me/${order.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Hi ' + order.name + '! This is ' + (process.env.BRAND_NAME || 'rto.GiO') + ' regarding your order ' + order.id)}
          `
        });
        console.log('[Order API] All notification emails triggered successfully.');
      } catch (e) {
        console.error('[Order API] Notification Error:', e.message);
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
