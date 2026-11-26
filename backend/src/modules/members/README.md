# Módulo `members`

## Responsabilidade

RF03–RF07: cadastro, listagem, edição, alteração de situação, vínculo de instrutor e consulta do próprio perfil.

## Rotas

- `POST /api/v1/members` — admin
- `GET /api/v1/members` — admin ou trainer (vê só os seus)
- `GET /api/v1/members/:id` — admin ou trainer
- `PATCH /api/v1/members/:id` — admin
- `PATCH /api/v1/members/:id/status` — admin
- `PUT /api/v1/members/:id/trainer` — admin
- `GET /api/v1/me` — member

## Regras de negócio

- Novo membro sempre começa ativo; e-mail é único e normalizado.
- A checagem de posse (RNF07/RD11) acontece no service, antes de qualquer leitura ou escrita — veja [ownership-pattern.md](../../../../docs/ownership-pattern.md).
- Senhas são sempre hashadas pelo `PasswordService`.

## Dependências

- `PasswordModule` (auth) para hash de senha
- `PrismaService`
- DTOs colocalizados em `dto/`

## Fora do escopo

Autenticação, criação de staff e planos de treino.
