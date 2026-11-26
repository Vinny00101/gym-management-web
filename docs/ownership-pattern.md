# Padrão de checagem de posse do recurso (RNF07/RD11)

A autorização tem duas camadas e as duas são obrigatórias:

1. **Papel** — `@Roles('admin')`, `@Roles('trainer')` ou `@Roles('member')` no controller, aplicado pelo `RolesGuard` global.
2. **Posse** — cada **service** verifica se o usuário logado pode acessar aquele registro específico, usando `OwnershipService.assertCanAccessMember()`.

O `@Roles()` define quem pode chamar a rota. Ele **não** substitui a checagem de posse: um instrutor com `@Roles('trainer')` só pode ver os seus membros, e um membro com `@Roles('member')` só pode ver os próprios dados.

## Regras

| Papel | Acesso a um membro |
| --- | --- |
| `admin` | qualquer membro |
| `trainer` | apenas membros cujo `instructorId` seja o seu `id` |
| `member` | apenas o registro cujo `id` seja o seu `id` |

Uma violação lança `ForbiddenException` (403), que o filtro global devolve no formato do RNF02 com `code: "FORBIDDEN"` e o `requestId`.

## Como aplicar no service

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../infra/database/prisma.service.js';
import { OwnershipService } from '../shared/identity/ownership.service.js';
import type { AuthenticatedUser } from '../shared/identity/auth.types.js';

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
  ) {}

  async findOne(currentUser: AuthenticatedUser, memberId: number) {
    const member = await this.prisma.user.findUnique({
      where: { id: memberId },
      select: { id: true, name: true, instructorId: true, passwordHash: false },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    // A checagem acontece no service, antes de qualquer retorno ou escrita.
    this.ownership.assertCanAccessMember(currentUser, member);
    return member;
  }
}
```

No controller, o usuário vem de `@CurrentUser()`:

```ts
@Get(':id')
@Roles(Role.admin, Role.trainer, Role.member)
findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
  return this.membersService.findOne(user, id);
}
```

## Listagens

Para listas, aplique o filtro no `where` do Prisma em vez de verificar item por item — assim o banco não devolve registros que o usuário não pode ver:

```ts
// admin: sem filtro
const where = currentUser.role === Role.admin ? {} : {
  ...(currentUser.role === Role.trainer
    ? { instructorId: currentUser.id }
    : { id: currentUser.id }),
};
return this.prisma.user.findMany({ where });
```

## Critérios atendidos

- `@Roles('admin')` bloqueia outros papéis com 403 — `RolesGuard`.
- `@CurrentUser()` fornece `{ id, role }` ao controller.
- Instrutor só acessa os seus membros; membro só acessa os próprios dados — `OwnershipService` + filtros no Prisma.
- Testes de acesso permitido e negado — `ownership.service.spec.ts`, `roles.guard.spec.ts` e `test/auth.e2e-spec.ts`.
