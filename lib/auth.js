import { cookies } from 'next/headers';
import CryptoJS from 'crypto-js';

const SESSION_SECRET = process.env.SESSION_SECRET || 'default-secret-change-me';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const COOKIE_NAME = 'duet_admin_session';

export function generateToken() {
  const payload = JSON.stringify({
    role: 'admin',
    ts: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  });
  return CryptoJS.AES.encrypt(payload, SESSION_SECRET).toString();
}

export function verifyToken(token) {
  try {
    const bytes = CryptoJS.AES.decrypt(token, SESSION_SECRET);
    const payload = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    if (payload.role !== 'admin') return false;
    if (Date.now() > payload.exp) return false;
    return true;
  } catch {
    return false;
  }
}

export function checkPassword(password) {
  return password === ADMIN_PASSWORD;
}

export async function isAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME);
  if (!session) return false;
  return verifyToken(session.value);
}

export function adminUnauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

export { COOKIE_NAME };
