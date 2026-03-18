import { verifyAuth } from './utils/auth.js';
import { sendStatusEmail } from './orders.js';

// Specific endpoint for admin to trigger manual status emails
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  
  if (!verifyAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { to_name, to_email, order_id, status_title, status_desc } = body;

    await sendStatusEmail({ to_name, to_email, order_id, status_title, status_desc });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
