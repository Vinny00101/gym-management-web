# Gestão de Academia

Sistema web para gestão de uma academia de ginástica, desenvolvido como Trabalho Final da disciplina Programação para a Web II (UFPI). É composto por uma API RESTful (NestJS) e um frontend (Vue), no mesmo repositório.

## Sobre o projeto

A API cobre o dia a dia de uma academia em um fluxo único, em vez de cadastros soltos: o administrador cadastra o membro e associa um instrutor, o instrutor monta o plano de treino, o membro faz check-in ao chegar e o administrador acompanha a frequência e os horários de maior movimento.

O sistema tem três papéis, cada um com acesso apenas ao que lhe cabe:

- **admin**: cadastra membros e equipe, altera a situação dos membros e consulta os indicadores da academia;
- **trainer** (instrutor): cria e atribui planos de treino e acompanha a frequência dos membros associados a ele;
- **member** (membro): consulta o próprio treino, faz check-in e vê o próprio histórico.

Além das regras de negócio, o projeto foca em requisitos de qualidade: pipeline de middlewares, formato padronizado de erros, segurança baseada no OWASP ASVS (hash de senha, JWT de curta duração, controle de acesso por papel e por posse do recurso), cache com Redis, múltiplas instâncias atrás de NGINX e deploy com Docker Compose e GitHub Actions.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Backend | Node.js 22+, TypeScript, NestJS 12 (ESM) |
| Banco | PostgreSQL com Prisma |
| Cache | Redis (`@nestjs/cache-manager`) |
| Autenticação | JWT (15 min) e hash de senha com argon2 |
| Validação | `class-validator` + `ValidationPipe` |
| Segurança | `helmet` e `@nestjs/throttler` |
| Logs | `nestjs-pino` com request id |
| Testes | Vitest + supertest |
| Frontend | Vue 3, Vite, TypeScript, Pinia, Vue Router e Axios |

O backend usa ESM: imports relativos terminam em `.js`. O código vive em `modules/` (domínios), `infra/` (infraestrutura) e `shared/` (regras comuns); as rotas ficam em `/api/v1`.

## Estrutura

```text
backend/    API NestJS + Prisma
frontend/   Vue 3 + Vite
docs/       requisitos, arquitetura e padrões
docker/     Compose de desenvolvimento
```

## Como rodar

1. Crie o `.env` a partir do exemplo e preencha `DATABASE_URL`, `POSTGRES_*`, `REDIS_URL`, `JWT_SECRET` e `ADMIN_*`:

   ```bash
   cp .env.example .env
   ```

2. Suba PostgreSQL e Redis:

   ```bash
   docker compose --env-file .env -f docker/docker-compose.dev.yml up -d
   ```

3. Instale, migre, crie o primeiro administrador e inicie a API:

   ```bash
   cd backend
   npm install
   npm run prisma:migrate
   npm run prisma:seed
   npm run start:dev
   ```

API em `http://localhost:3000`, Swagger em `/api/docs` e health check em `/api/health`.

| Comando | O que faz |
| --- | --- |
| `npm run build` | Compila para `dist/` |
| `npm run lint` | oxlint com checagem de tipos |
| `npm test` | Testes unitários |
| `npm run test:e2e` | Testes end-to-end |

## Decisões principais

- Access token de 15 min em memória; refresh token em cookie `httpOnly`, com apenas o hash no banco.
- Rotas em `/api/v1`; health check em `/api/health` e Swagger em `/api/docs`.
- Primeiro administrador criado por `npm run prisma:seed`, com credenciais do `.env`.
- Erros e logs seguem um formato único, com request id.

A arquitetura e a pipeline de requisições estão em [docs/architecture.md](docs/architecture.md) e [docs/requirements.md](docs/requirements.md).

## Convenção de commits

Formato: `<tipo>(<escopo>): <descrição>`, com descrição no imperativo, em português e sem ponto final.

Tipos: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `style`, `chore`.

Exemplo: `feat(auth): adiciona login com e-mail e senha`

`feat` e `fix` geram as entradas do [CHANGELOG](CHANGELOG.md). Mudanças incompatíveis usam `!` ou `BREAKING CHANGE:`.

## Documentação

- [Requisitos](docs/requirements.md)
- [Arquitetura](docs/architecture.md)
- [Posse do recurso](docs/ownership-pattern.md)
- [Changelog](CHANGELOG.md)

## Escopo por etapa

| Etapa | Foco | Requisitos |
| --- | --- | --- |
| Parte 1 | Base da API, autenticação e membros | RF01–RF07, RNF01–RNF10, RNF14, RD01, RD05, RD09–RD11 |
| Parte 2 | Treinos e check-in | RF08–RF14, RD02, RD03, RD06–RD08 |
| Parte 3 | Relatórios, cache e deploy | RF15–RF18, RNF11–RNF13, RNF15, RNF16, RD04, RD12 |
