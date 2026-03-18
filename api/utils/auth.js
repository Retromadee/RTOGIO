import { parse } from 'cookie';
import crypto from 'crypto';

export function verifyAuth(req) {
  const cookies = parse(req.headers.cookie || '');
  const token = cookies.auth_token;
  
  if (!token) return false;

  // Simple token verification built around the server secret
  const expectedToken = crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(process.env.ADMIN_PIN)
    .digest('hex');
    
  return token === expectedToken;
}
