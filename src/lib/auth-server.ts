import { randomBytes } from 'node:crypto';
import { jwtVerify, SignJWT, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';

function resolveJwtSecret(): string {
  const configured = process.env.JWT_SECRET?.trim();

  if (configured) {
    if (configured.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long.');
    }
    return configured;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production.');
  }

  // Development sessions intentionally become invalid after a process restart.
  // This avoids a shared fallback secret across machines/environments.
  return `dev-only-${randomBytes(32).toString('hex')}`;
}

const JWT_SECRET = new TextEncoder().encode(resolveJwtSecret());
const AUTH_COOKIE_NAME = 'auth_token';
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export interface TokenPayload extends JWTPayload {
  id: string;
  email: string;
  role: 'admin' | 'user';
  name: string;
  avatarUrl?: string;
  provider?: string;
  status?: 'active' | 'blocked' | 'disabled';
}

function isValidRole(value: unknown): value is TokenPayload['role'] {
  return value === 'admin' || value === 'user';
}

function isValidStatus(value: unknown): value is NonNullable<TokenPayload['status']> {
  return value === undefined || value === 'active';
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    });

    if (
      typeof payload.id !== 'string' ||
      payload.id.length === 0 ||
      typeof payload.email !== 'string' ||
      payload.email.length === 0 ||
      typeof payload.name !== 'string' ||
      !isValidRole(payload.role) ||
      !isValidStatus(payload.status)
    ) {
      return null;
    }

    return payload as TokenPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: TokenPayload) {
  const cookieStore = await cookies();
  const token = await signToken(payload);
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });
}

export async function getSession(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return await verifyToken(token);
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}

export async function getAuthoritativeSession(): Promise<TokenPayload | null> {
  const session = await getSession();
  if (!session) return null;

  try {
    const [{ db }, { users }, { eq }] = await Promise.all([
      import('@/lib/db'),
      import('@/db/schema'),
      import('drizzle-orm'),
    ]);
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
        role: users.role,
        status: users.status,
      })
      .from(users)
      .where(eq(users.id, session.id))
      .limit(1);
    const user = rows[0];

    if (!user || user.status !== 'active' || (user.role !== 'admin' && user.role !== 'user')) {
      return null;
    }

    return {
      ...session,
      id: user.id,
      name: user.name || session.name,
      email: user.email || session.email,
      avatarUrl: user.avatarUrl || session.avatarUrl,
      role: user.role,
      status: 'active',
    };
  } catch (error) {
    console.error('Authoritative session lookup failed:', error);
    // In production, fail closed if the user record cannot be verified.
    return process.env.NODE_ENV === 'production' ? null : session;
  }
}

export async function requireActiveSession() {
  return await getAuthoritativeSession();
}

export async function requireAdmin() {
  const session = await getAuthoritativeSession();
  if (!session || session.role !== 'admin') {
    return false;
  }
  return session;
}
