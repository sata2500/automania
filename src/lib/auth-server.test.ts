import { describe, expect, it } from 'vitest';
import { signToken, verifyToken, type TokenPayload } from './auth-server';

const validPayload: TokenPayload = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'Test User',
  role: 'user',
  status: 'active',
  provider: 'google',
};

describe('auth token validation', () => {
  it('signs and verifies a valid active payload', async () => {
    const token = await signToken(validPayload);
    const verified = await verifyToken(token);

    expect(verified).toMatchObject(validPayload);
  });

  it('rejects a blocked payload even when the signature is valid', async () => {
    const token = await signToken({ ...validPayload, status: 'blocked' });

    await expect(verifyToken(token)).resolves.toBeNull();
  });

  it('rejects a payload with an invalid role', async () => {
    const token = await signToken({
      ...validPayload,
      role: 'owner',
    } as unknown as TokenPayload);

    await expect(verifyToken(token)).resolves.toBeNull();
  });
});
