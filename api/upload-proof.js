import { getDbInstance, ref, update } from './utils/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { orderId, base64Str, order } = body;

    const db = getDbInstance();
    await update(ref(db, `orders/${orderId}`), { proofOfPayment: base64Str });

    // Send admin notification (Optional: Can be added to orders.js later if needed)
    console.log(`[Upload Proof] Proof uploaded for order ${orderId}`);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed' });
  }
}
