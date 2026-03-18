import { Resend } from 'resend';
import { getDbInstance, ref, get, set, update } from './utils/db.js';
import { verifyAuth } from './utils/auth.js';

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendOrderEmails(order) {
  const brandName = process.env.BRAND_NAME || 'rto.GiO';
  const adminEmail = process.env.ADMIN_EMAIL || 'retromadee@gmail.com'; // Fallback admin email
  const adminWhatsApp = process.env.ADMIN_WHATSAPP || '905338365711';
  
  const waUserLink = `https://wa.me/${order.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Hi ' + order.name + '! This is ' + brandName + ' regarding your order ' + order.id)}`;
  
  // 1. Send to Customer
  try {
    await resend.emails.send({
      from: `${brandName} <orders@resend.dev>`, // Generic resend address unless domain verified
      to: order.email,
      subject: `Order Confirmed: ${order.id}`,
      html: `
        <div style="font-family:sans-serif; max-width:600px; margin:0 auto; border:1px solid #eee; padding:20px;">
          <h2 style="color:#000;">Thank you for your order, ${order.name}!</h2>
          <p>Your order <strong>${order.id}</strong> has been received and is being processed.</p>
          <hr style="border:none; border-top:1px solid #eee;">
          <p><strong>Item:</strong> ${order.productName} (x${order.qty})</p>
          <p><strong>Total:</strong> £${order.total}</p>
          <p><strong>Payment:</strong> ${order.payment}</p>
          <p><strong>Delivery:</strong> ${order.location}</p>
          <hr style="border:none; border-top:1px solid #eee;">
          <p>Need help? Contact us via WhatsApp:</p>
          <a href="https://wa.me/${adminWhatsApp.replace(/\D/g, '')}" style="background:#25D366; color:#fff; padding:10px 20px; text-decoration:none; border-radius:5px; display:inline-block;">Message on WhatsApp</a>
        </div>
      `
    });
    console.log(`[Resend] Confirmation sent to ${order.email}`);
  } catch (err) {
    console.error('[Resend] User Email Error:', err.message);
  }

  // 2. Send to Admin
  try {
    await resend.emails.send({
      from: 'rto.GiO Alerts <alerts@resend.dev>',
      to: adminEmail,
      subject: `NEW ORDER: ${order.id} - ${order.name}`,
      html: `
        <div style="font-family:sans-serif; padding:20px;">
          <h3>New Order Received</h3>
          <p><strong>Customer:</strong> ${order.name}</p>
          <p><strong>Item:</strong> ${order.productName} (x${order.qty})</p>
          <p><strong>Total:</strong> £${order.total}</p>
          <p><strong>Phone:</strong> ${order.phone}</p>
          <p><strong>Email:</strong> ${order.email}</p>
          <p><strong>Payment:</strong> ${order.payment}</p>
          <p><strong>Location:</strong> ${order.location}</p>
          <br>
          <a href="${waUserLink}" style="background:#000; color:#fff; padding:10px 20px; text-decoration:none; border-radius:5px;">Contact Customer via WhatsApp</a>
        </div>
      `
    });
    console.log(`[Resend] Admin alert sent to ${adminEmail}`);
  } catch (err) {
    console.error('[Resend] Admin Email Error:', err.message);
  }
}

async function sendStatusEmail({ to_name, to_email, order_id, status_title, status_desc }) {
  const brandName = process.env.BRAND_NAME || 'rto.GiO';
  
  try {
    await resend.emails.send({
      from: `${brandName} <updates@resend.dev>`,
      to: to_email,
      subject: `Update on Order ${order_id}: ${status_title}`,
      html: `
        <div style="font-family:sans-serif; max-width:600px; margin:0 auto; border:1px solid #eee; padding:20px;">
          <h2 style="color:#000;">Order Update</h2>
          <p>Hi ${to_name},</p>
          <p>There is a new update on your <strong>${brandName}</strong> order <strong>${order_id}</strong>:</p>
          <div style="background:#f9f9f9; padding:15px; border-radius:5px; margin:20px 0;">
            <p style="margin:0; font-weight:bold;">${status_title}</p>
            <p style="margin:5px 0 0; color:#666;">${status_desc}</p>
          </div>
          <p>You can track your order live on our website using your Order ID.</p>
          <hr style="border:none; border-top:1px solid #eee;">
          <small style="color:#999;">If you have any questions, simply reply to this email or contact us on WhatsApp.</small>
        </div>
      `
    });
    console.log(`[Resend] Status update sent to ${to_email}`);
  } catch (err) {
    console.error('[Resend] Status Email Error:', err.message);
    throw err;
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
        await sendOrderEmails(order);
      } catch (e) {
        console.error('[Order API] Notification Warning:', e.message);
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

export { sendOrderEmails, sendStatusEmail };
