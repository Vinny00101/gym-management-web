# Módulo `auth`

## Responsabilidade

RF01 e RNF06/RNF14: login, emissão de access token JWT, emissão/rotação/revogação do refresh token e logout. Ownership do `PasswordService` (RNF05), usado também pelos cadastros de `members` e `staff`.

## Rotas

- `POST /api/v1/auth/login` — `@Public`, limitado a 5 tentativas/minuto por IP
- `POST /api/v1/auth/refresh` — `@Public`, lê o cookie `refresh_token`
- `POST /api/v1/auth/logout` — `@Public`, revoga o token e limpa o cookie

## Regras de negócio

- Access token com HS256 fixo, segredo de `JWT_SECRET` e expiração de 15 minutos — a configuração vive em `shared/identity/identity.module.ts`.
- Refresh token opaco em cookie `httpOnly` com `Path=/api/v1/auth`; só o hash SHA-256 é gravado no banco.
- Rotação acontece em transação: o token antigo deixa de valer no mesmo ato em que o novo é criado.
- Falhas de login e logins bem-sucedidos geram eventos de segurança sem a senha (RNF10).

## Dependências

- `shared/identity/identity.module.ts` — `JwtService`, `SecurityEventService`
- `PrismaService`, `ConfigService`
- `PasswordModule` — exportado para `members` e `staff`

## Fora do escopo

Autorização por papel/posse, cadastro de usuários e planos de treino.
