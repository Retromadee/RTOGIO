import { serialize } from 'cookie';

export default async function handler(req, res) {
  const cookie = serialize('auth_token', '', {
    path: '/',
    httpOnly: true,
    maxAge: -1
  });
  
  res.setHeader('Set-Cookie', cookie);
  return res.status(200).json({ success: true });
}
