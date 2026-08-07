import { jwtVerify, SignJWT, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';

if (!process.env.JWT_SECRET) {
  throw new Error(
    'FATAL: JWT_SECRET environment variable is not set. ' +
    'Add JWT_SECRET to your .env.local file before starting the application.'
  );
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// Extends JWTPayload so jose's SignJWT accepts it directly without unsafe casts
export interface TokenPayload extends JWTPayload {
  id: string;
  email: string;
  role: 'admin' | 'user';
  name: string;
  avatarUrl?: string;
  provider?: string;
  status?: string;
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    // Runtime guard: ensure required fields are present before trusting
    if (typeof payload.id === 'string' && typeof payload.email === 'string') {
      return payload as TokenPayload;
    }
    return null;
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: TokenPayload) {
  const cookieStore = await cookies();
  const token = await signToken(payload);
  cookieStore.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  });
}

export async function getSession(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) return null;
  return await verifyToken(token);
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete('auth_token');
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return false;
  }
  return session;
}
