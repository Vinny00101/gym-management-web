import { stripSensitiveData } from './sensitive-data.interceptor.js';

describe('stripSensitiveData', () => {
  it('remove hashes e senhas de objetos aninhados e arrays', () => {
    const input = {
      accessToken: 'jwt-value',
      passwordHash: '$argon2id$secret',
      tokenHash: 'sha256-secret',
      user: {
        name: 'Ana',
        password: 'plain-secret',
        refresh_token: 'opaque-secret',
        member: { id: 1, passwordHash: '$argon2id$another' },
      },
      items: [{ id: 1, password: 'nested-secret' }],
    };

    expect(stripSensitiveData(input)).toEqual({
      accessToken: 'jwt-value',
      user: {
        name: 'Ana',
        member: { id: 1 },
      },
      items: [{ id: 1 }],
    });
  });

  it('preserva datas e valores primitivos', () => {
    const createdAt = new Date('2026-11-20T00:00:00Z');

    expect(stripSensitiveData({ createdAt, active: true, count: 3 })).toEqual({
      createdAt,
      active: true,
      count: 3,
    });
  });

  it('não entra em loop com referências circulares', () => {
    const node: Record<string, unknown> = { id: 1, passwordHash: 'secret' };
    node.self = node;

    const result = stripSensitiveData(node) as Record<string, unknown>;

    expect(result.passwordHash).toBeUndefined();
    expect(result.self).toBe(result);
  });
});
