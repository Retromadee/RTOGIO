import { Resend } from 'resend';
import { getDbInstance, ref, get, set, update } from './utils/db.js';
import { verifyAuth } from './utils/auth.js';

let resend;
try {
  if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  } else {
    console.warn('[Order API] RESEND_API_KEY is missing. Emails will be disabled.');
  }
} catch (e) {
  console.error('[Order API] Failed to initialize Resend:', e.message);
}

async function sendOrderEmails(order) {
  const brandName = process.env.BRAND_NAME || 'rto.GiO';
  const adminEmailList = (process.env.ADMIN_EMAIL || 'only1retromade@gmail.com').split(',').map(e => e.trim());
  const adminWhatsApp = process.env.ADMIN_WHATSAPP || '905338365711';
  
  const waUserLink = `https://wa.me/${order.phone.replace(/\D/g, '')}?text=${encodeURIComponent('Hi ' + order.name + '! This is ' + brandName + ' regarding your order ' + order.id)}`;
  
  // 1. Send to Customer
  if (!resend) {
    console.warn('[Resend] Customer email skipped (Resend not initialized)');
    return;
  }
  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev', // Use default for unverified domains
      to: order.email,
      subject: `rto.GiO Order Confirmed : ${order.id}`,
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
  if (!resend) {
    console.warn('[Resend] Admin email skipped (Resend not initialized)');
    return;
  }
  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: adminEmailList,
      subject: `rto.GiO NEW ORDER : ${order.id} - ${order.name}`,
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
    console.log(`[Resend] Admin alert sent to ${adminEmailList.join(', ')}`);
  } catch (err) {
    console.error('[Resend] Admin Email Error:', err.message);
  }
}

async function sendStatusEmail({ to_name, to_email, order_id, status_title, status_desc }) {
  const brandName = process.env.BRAND_NAME || 'rto.GiO';
  
  if (!resend) {
    console.warn('[Resend] Status email skipped (Resend not initialized)');
    return;
  }
  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: to_email,
      subject: `rto.GiO Update on Order ${order_id}: ${status_title}`,
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
    const { id } = req.query;

    try {
      if (id) {
        // Public: Track specific order
        const snap = await get(ref(db, `orders/${id}`));
        if (snap.exists()) {
          return res.status(200).json(snap.val());
        }
        return res.status(404).json({ error: 'Order not found' });
      } else {
        // Admin: List all orders
        const isAuthed = verifyAuth(req);
        console.log(`[API/Orders] Admin List Request - Authed: ${isAuthed}`);
        
        if (!isAuthed) return res.status(401).json({ error: 'Unauthorized' });
        
        const { excludeProofs } = req.query;
        const snap = await get(ref(db, 'orders'));
        
        console.log(`[API/Orders] Data exists: ${snap.exists()}`);
        
        if (snap.exists()) {
          const data = snap.val();
          const orders = Object.entries(data).map(([key, val]) => ({
            ...val,
            id: val.id || key // Use existing id or fallback to database key
          }));
          
          console.log(`[API/Orders] Returning ${orders.length} orders`);
          
          if (excludeProofs === 'true') {
            orders.forEach(o => {
               if (o.proofOfPayment) o.hasProof = true;
               delete o.proofOfPayment;
            });
          }
          
          return res.status(200).json(orders);
        }
        return res.status(200).json([]);
      }
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed' });
    }
  }

  if (req.method === 'POST') {
    // Public: Create order
    try {
      let body;
      try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      } catch (parseErr) {
        console.error('[Order API] Body Parse Error:', parseErr.message, 'Raw body:', req.body);
        return res.status(400).json({ error: 'Invalid request body' });
      }

      const order = body;
      if (!order || !order.id || !order.productId) {
        console.error('[Order API] Missing required fields:', { 
          hasOrder: !!order, 
          id: order?.id, 
          productId: order?.productId 
        });
        return res.status(400).json({ error: 'Missing order details' });
      }

      console.log(`[Order API] Processing order ${order.id} for ${order.email}`);
      order.createdAt = new Date().toISOString();

      // 1. Decrement stock
      let newStock;
      try {
        const stockRef = ref(db, `inventory/${order.productId}/stock`);
        const snap = await get(stockRef);
        const current = snap.val() || 0;
        newStock = Math.max(0, current - order.qty);
        await set(stockRef, newStock);
        console.log(`[Order API] Stock updated for ${order.productId}: ${current} -> ${newStock}`);
      } catch (dbErr) {
        console.error('[Order API] Database Error (Stock):', dbErr.message);
        throw new Error(`Database failure updating stock: ${dbErr.message}`);
      }

      // 2. Save order
      try {
        await set(ref(db, `orders/${order.id}`), order);
        console.log(`[Order API] Order saved to database: ${order.id}`);
      } catch (dbErr) {
        console.error('[Order API] Database Error (Save Order):', dbErr.message);
        throw new Error(`Database failure saving order: ${dbErr.message}`);
      }

      // 3. Send emails (Non-blocking but logged)
      try {
        await sendOrderEmails(order);
      } catch (emailErr) {
        console.error('[Order API] Email Notification Error:', emailErr.message);
        // We don't throw here to ensure the user gets a success response even if email fails
      }

      return res.status(200).json({ success: true, newStock });
    } catch (err) {
      console.error('[Order API] Fatal Error:', err.message, err.stack);
      return res.status(500).json({ 
        error: 'Failed to process order', 
        details: err.message,
        timestamp: new Date().toISOString()
      });
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
