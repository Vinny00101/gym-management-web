import {
  adminIndicatorsKey,
  cacheKey,
  currentPlanKey,
  currentPlanPrefix,
} from './cache-keys.js';

describe('cache keys', () => {
  it('separa usuários e papéis para não vazar dados entre requests', () => {
    expect(currentPlanKey(7, 'member')).not.toBe(currentPlanKey(8, 'member'));
    expect(currentPlanKey(7, 'member')).not.toBe(currentPlanKey(7, 'admin'));
    expect(adminIndicatorsKey(7, 'admin')).not.toBe(
      adminIndicatorsKey(7, 'member'),
    );
  });

  it('oferece prefixo estável para invalidar todos os papéis de um usuário', () => {
    const key = currentPlanKey(7, 'member');

    expect(key).toMatch(new RegExp(`^${currentPlanPrefix(7)}:`));
  });

  it('monta chaves legíveis', () => {
    expect(cacheKey('reports', 'monthly', 2026, 11)).toBe(
      'reports:monthly:2026:11',
    );
  });
});
