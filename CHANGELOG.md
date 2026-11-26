# Changelog

## [Não lançado]

### Refatoração da arquitetura

- Documentação da arquitetura alvo e plano de migração em PRs ([docs/architecture.md](docs/architecture.md))
- Módulos de infraestrutura em `infra/` e cache Redis com fallback em memória nos testes
- Pipeline HTTP centralizada em `setupApp()`, rotas sob `/api/v1` e Swagger gerado por factory
- Módulos por domínio em `modules/`: `auth`, `members`, `staff` e `workout-plans`

### Parte 2: treinos e check-in

- Migração com `WorkoutPlan`, `WorkoutDivision`, `Exercise` e `CheckIn`
- Criação de plano de treino com divisões (RF08)

## [0.1.0] - 2026-11-20

Base da API, autenticação e gestão de membros (RF01–RF07, RNF01–RNF10, RNF14, RD01, RD05, RD09–RD11).

### Implementado

- Estrutura do repositório (`backend/`, `frontend/`, `docs/`), projeto NestJS 12, `.env.example`, validação de variáveis e Docker Compose de desenvolvimento
- Prisma com PostgreSQL, migrações iniciais de usuários e seed do primeiro administrador
- `helmet`, `GET /api/health`, Swagger em `/api/docs` e tratamento de erros centralizado
- Pipeline de middlewares: request id, logging, sanitização, validação, JWT de 15 min e autorização por papel e posse
- Login, refresh com rotação e logout: access token no cliente, refresh token em cookie `httpOnly` e hash SHA-256 no banco
- `PasswordService` com argon2, limite de 5 logins/min por IP e eventos de segurança
- Cadastro de instrutores/administradores e de membros, listagem com filtros, edição de dados e situação
- Associação de instrutor responsável e consulta do próprio perfil e do instrutor
- Testes unitários e e2e de autenticação, posse, refresh token e gestão de membros
