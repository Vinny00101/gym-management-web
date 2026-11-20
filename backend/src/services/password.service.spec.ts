import { Test } from '@nestjs/testing';
import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PasswordService],
    }).compile();
    service = moduleRef.get(PasswordService);
  });

  it('gera um hash argon2 que não contém a senha em texto puro', async () => {
    const hash = await service.hash('Senha@123');

    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('Senha@123');
  });

  it('usa salt: a mesma senha gera hashes diferentes', async () => {
    const first = await service.hash('Senha@123');
    const second = await service.hash('Senha@123');

    expect(first).not.toBe(second);
  });

  it('confere a senha correta e rejeita uma senha errada', async () => {
    const hash = await service.hash('Senha@123');

    await expect(service.verify('Senha@123', hash)).resolves.toBe(true);
    await expect(service.verify('senha-errada', hash)).resolves.toBe(false);
  });

  it('retorna false para um hash malformado', async () => {
    await expect(service.verify('Senha@123', 'not-a-hash')).resolves.toBe(false);
  });
});
