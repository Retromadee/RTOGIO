import { serialize } from 'cookie';
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { pin } = body;
  
  if (pin === process.env.ADMIN_PIN) {
    const token = crypto
      .createHmac('sha256', process.env.JWT_SECRET)
      .update(process.env.ADMIN_PIN)
      .digest('hex');
      
    const cookie = serialize('auth_token', token, {
      path: '/',
      httpOnly: true, // Cannot be accessed by client-side JS
      secure: process.env.NODE_ENV !== 'development',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      sameSite: 'strict'
    });
    
    res.setHeader('Set-Cookie', cookie);
    return res.status(200).json({ success: true });
  } else {
    return res.status(401).json({ success: false, message: 'Invalid PIN' });
  }
}
