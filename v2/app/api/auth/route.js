import { checkPassword, generateToken, COOKIE_NAME } from '@/lib/auth';

// POST /api/auth - Admin login
export async function POST(request) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!checkPassword(password)) {
      return Response.json({ error: 'Invalid password' }, { status: 401 });
    }

    const token = generateToken();

    const response = Response.json({ success: true });
    response.headers.set(
      'Set-Cookie',
      `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 24}`
    );

    return response;
  } catch (error) {

    return Response.json({ error: 'Auth failed' }, { status: 500 });
  }
}
