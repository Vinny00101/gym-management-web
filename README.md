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
| Backend | Node.js 22 LTS (22.22.3 ou mais novo) ou 24, npm 11, TypeScript 6, NestJS 12 (ESM) |
| Banco de dados | PostgreSQL com Prisma (ORM e migrações) |
| Cache | Redis via `@nestjs/cache-manager` |
| Autenticação | JWT (`@nestjs/jwt` com HS256 e guard próprio) e hash de senha com `argon2` |
| Validação | `class-validator` + `ValidationPipe` (`whitelist` e `forbidNonWhitelisted` ativos) |
| Segurança | `helmet`, `@nestjs/throttler` (limite de tentativas no login) |
| Logs | `nestjs-pino`, com request id em todas as requisições |
| Documentação da API | Swagger com `@nestjs/swagger` |
| Testes | Vitest + supertest |
| Frontend | Vue 3, Vite, TypeScript, Pinia, Vue Router e Axios |
| Infraestrutura | Docker Compose (API em 2 instâncias, PostgreSQL, Redis e NGINX) e GitHub Actions |
| Qualidade de código | oxlint, Prettier e Conventional Commits |

O backend usa **ESM**: imports relativos terminam em `.js` (`import { PasswordService } from './services/password.service.js'`), `__dirname` não existe (use `import.meta.dirname`) e os mocks dos testes usam `vi.fn()`, não `jest.fn()`.

O `backend/src` é organizado por **módulos de domínio** em `modules/` (`auth`, `members`, `staff`, `workout-plans`), cada um com controller, service, DTOs e README. A infraestrutura vive em `infra/` e as regras cross-cutting em `shared/`. As rotas são versionadas em `/api/v1`. Essa estrutura vem da refatoração aprovada na [issue #45](https://github.com/Vinny00101/gym-management-web/issues/45); o diagnóstico, a estrutura alvo e o plano em PRs estão em [docs/architecture.md](docs/architecture.md).

### Pipeline de requisição (RNF01)

As etapas do [RNF01](docs/requirements.md#requisitos-não-funcionais) correspondem às peças do NestJS, que executam nesta ordem:

| Etapa do RNF01 | Peça no NestJS |
| --- | --- |
| Logging | Middleware (`nestjs-pino`) |
| Sanitização | Middleware |
| Autenticação | Guard (`JwtAuthGuard`) |
| Autorização | Guard (`RolesGuard` + decorator `@Roles()`) |
| Validação | Pipe (`ValidationPipe` com DTOs) |
| Handler | Controller → Service |
| Tratamento de erros | Exception Filter global (formato JSON único do RNF02) |

## Decisões técnicas

- **Sessão com access e refresh token.** O access token dura 15 minutos (RNF06) e fica só na memória do frontend. O refresh token vai num cookie `httpOnly` e o banco guarda apenas o hash dele; `POST /auth/refresh` emite um novo access token. Como nada fica na memória da instância, a API continua stateless (RNF14).
- **Mesmo domínio para front e API.** O NGINX serve o Vue em `/` e a API em `/api`, o que evita configuração de CORS. Em desenvolvimento, o proxy do Vite faz o mesmo papel.
- **Rotas versionadas.** O prefixo global é `/api` e o versionamento URI usa `v1` como padrão, então os endpoints ficam em `/api/v1/...`. O health check é version-neutral (`/api/health`) e o Swagger continua em `/api/docs`.
- **Tipos compartilhados.** Os tipos do frontend são gerados a partir do Swagger da API com `openapi-typescript`.
- **Primeiro administrador por seed.** Como só um admin cadastra outro admin (RF02), o primeiro é criado por `prisma db seed`, com credenciais lidas de variáveis de ambiente.
- **Um check-in por dia garantido no banco.** O RD03 é imposto por uma restrição única em `(memberId, data do check-in)`, e não só no código, porque com duas instâncias da API duas requisições simultâneas passariam pela checagem.
- **Fuso horário.** Datas são gravadas em UTC e os cálculos por dia e por hora (RD03, RD12, RF15, RF17) usam `America/Sao_Paulo`.
- **Configuração validada na inicialização.** `@nestjs/config` valida as variáveis de ambiente; a API não sobe sem `JWT_SECRET`, `DATABASE_URL` e as demais obrigatórias.
- **Guards globais.** `ThrottlerGuard`, `JwtAuthGuard` e `RolesGuard` executam nessa ordem; rotas públicas (health, Swagger, `/api/v1/auth/*`) são marcadas com `@Public()` e o usuário autenticado chega ao controller por `@CurrentUser()`. O padrão de posse do recurso dos services está em [docs/ownership-pattern.md](docs/ownership-pattern.md).
- **Eventos de segurança.** Falhas de login e acessos negados viram eventos no log com e-mail tentado (quando aplicável), IP e request id — nunca com a senha.
- **Health check.** `GET /api/health` (`@nestjs/terminus`) é usado pelo NGINX e pelo Docker para saber se cada instância está ativa.
- **Repositório único.** API e frontend ficam no mesmo repositório (`gym-management-web`), o que simplifica o Docker Compose e o CI:

  ```
  gym-management-web/
  ├── backend/    # NestJS + Prisma
  ├── frotend/        # Vue 3 + Vite
  ├── docs/       # requisitos
  ├── nginx/      # configuração do proxy reverso
  ├── docker-compose.yml
  ├── README.md
  └── CHANGELOG.md
  ```

## Convenção de commits

Os commits seguem [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/), no formato `<tipo>(<escopo>): <descrição>`. O escopo é opcional, a descrição vai no imperativo, em português e sem ponto final.

| Tipo | Uso |
| --- | --- |
| `feat` | nova funcionalidade |
| `fix` | correção de bug |
| `docs` | documentação |
| `test` | criação ou ajuste de testes |
| `refactor` | mudança de código sem alterar o comportamento |
| `perf` | melhoria de performance |
| `build` | build, dependências ou configuração do projeto |
| `ci` | pipeline de integração contínua |
| `style` | formatação, sem mudança de lógica |
| `chore` | tarefas de manutenção |

Exemplos:

```text
feat(auth): adiciona login com e-mail e senha
fix(membros): corrige filtro por situação
docs: documenta a convenção de commits
```

Mudanças incompatíveis levam `!` antes dos dois-pontos (`feat(api)!: troca o formato do erro`) ou o rodapé `BREAKING CHANGE: ...`. Os commits `feat` e `fix` são a base das entradas do [CHANGELOG](CHANGELOG.md): `fix` corresponde a um *patch* e `feat` a uma *minor* do Versionamento Semântico, enquanto uma mudança incompatível indica *major*.

## Como rodar

### 1. Variáveis de ambiente

Na raiz do repositório, crie o arquivo `.env` a partir do exemplo (usado pelo backend e pelo Docker Compose de desenvolvimento):

```bash
cp .env.example .env
```

Ajuste os valores conforme necessário. Em desenvolvimento, as credenciais do banco no `.env` (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `DATABASE_URL`) devem permanecer consistentes entre si.

Defina também `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` para criar o primeiro administrador. Use uma senha forte e não compartilhe nem registre essas credenciais. `REDIS_URL` é obrigatório fora de testes; `CACHE_TTL` define o TTL do cache em milissegundos (padrão: `300000`).

### 2. Infraestrutura local (PostgreSQL e Redis)

Suba os serviços de desenvolvimento definidos em `docker/docker-compose.dev.yml`:

```bash
docker compose --env-file .env -f docker/docker-compose.dev.yml up -d
```

Para acompanhar o status/health checks:

```bash
docker compose --env-file .env -f docker/docker-compose.dev.yml ps
```

Para parar e remover os containers (os volumes persistentes são mantidos):

```bash
docker compose --env-file .env -f docker/docker-compose.dev.yml down
```

### 3. Backend (API)

```bash
cd backend
npm install
npm run start:dev      # API em http://localhost:3000
```

A documentação interativa da API fica em `http://localhost:3000/api/docs`. O endpoint público `GET /api/health` verifica a conexão com o banco e responde com status 503 quando ele está indisponível.
Com o PostgreSQL iniciado e as migrações aplicadas, crie o primeiro administrador:

```bash
npm run prisma:seed
```

O seed usa as variáveis `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` do `.env`. Ele pode ser executado novamente sem duplicar o administrador.

| Comando | O que faz |
| --- | --- |
| `npm run build` | Compila para `dist/` |
| `npm run lint` | oxlint com checagem de tipos |
| `npm test` | Testes unitários (Vitest) |
| `npm run test:e2e` | Testes end-to-end (Vitest + supertest) |
| `npm run start:prod` | Roda a versão compilada |

## Documentação

A arquitetura do backend e o plano de refatoração estão em [docs/architecture.md](docs/architecture.md).

Os requisitos completos estão em [docs/requirements.md](docs/requirements.md):

- [Papéis](docs/requirements.md#papéis) e [fluxo principal](docs/requirements.md#fluxo-principal)
- [Módulos](docs/requirements.md#módulos): membros, treinos e frequência
- [Requisitos funcionais (RF01–RF18)](docs/requirements.md#requisitos-funcionais)
- [Requisitos não funcionais (RNF01–RNF16)](docs/requirements.md#requisitos-não-funcionais)
- [Requisitos de domínio (RD01–RD12)](docs/requirements.md#requisitos-de-domínio)

## Escopo por etapa

O que será entregue em cada etapa fica registrado no [CHANGELOG](CHANGELOG.md). As tasks da Parte 1, com responsáveis e critérios de aceite, estão em [docs/tasks-parte-1.md](docs/tasks-parte-1.md).

| Etapa | Foco | Requisitos |
| --- | --- | --- |
| Parte 1 | Base da API, autenticação e gestão de membros | RF01–RF07, RNF01–RNF10, RNF14, RD01, RD05, RD09–RD11 |
| Parte 2 | Treinos e check-in | RF08–RF14, RD02, RD03, RD06–RD08 |
| Parte 3 | Relatórios, cache, escalabilidade e deploy | RF15–RF18, RNF11–RNF13, RNF15, RNF16, RD04, RD12 |
