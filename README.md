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
| Backend | Node.js 22 LTS, TypeScript, NestJS |
| Banco de dados | PostgreSQL com Prisma (ORM e migrações) |
| Cache | Redis via `@nestjs/cache-manager` |
| Autenticação | JWT (`@nestjs/jwt` + `passport-jwt`) e hash de senha com `argon2` |
| Validação | `class-validator` + `ValidationPipe` (`whitelist` e `forbidNonWhitelisted` ativos) |
| Segurança | `helmet`, `@nestjs/throttler` (limite de tentativas no login) |
| Logs | `nestjs-pino`, com request id em todas as requisições |
| Documentação da API | Swagger com `@nestjs/swagger` |
| Testes | Jest + supertest |
| Frontend | Vue 3, Vite, TypeScript, Pinia, Vue Router e Axios |
| Infraestrutura | Docker Compose (API em 2 instâncias, PostgreSQL, Redis e NGINX) e GitHub Actions |
| Qualidade de código | ESLint, Prettier e Conventional Commits |

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
- **Tipos compartilhados.** Os tipos do frontend são gerados a partir do Swagger da API com `openapi-typescript`.
- **Primeiro administrador por seed.** Como só um admin cadastra outro admin (RF02), o primeiro é criado por `prisma db seed`, com credenciais lidas de variáveis de ambiente.
- **Um check-in por dia garantido no banco.** O RD03 é imposto por uma restrição única em `(memberId, data do check-in)`, e não só no código, porque com duas instâncias da API duas requisições simultâneas passariam pela checagem.
- **Fuso horário.** Datas são gravadas em UTC e os cálculos por dia e por hora (RD03, RD12, RF15, RF17) usam `America/Sao_Paulo`.
- **Configuração validada na inicialização.** `@nestjs/config` valida as variáveis de ambiente; a API não sobe sem `JWT_SECRET`, `DATABASE_URL` e as demais obrigatórias.
- **Health check.** `GET /health` (`@nestjs/terminus`) é usado pelo NGINX e pelo Docker para saber se cada instância está ativa.
- **Repositório único.** API e frontend ficam no mesmo repositório (`gym-management-web`), o que simplifica o Docker Compose e o CI:

  ```
  gym-management-web/
  ├── api/        # NestJS + Prisma
  ├── web/        # Vue 3 + Vite
  ├── docs/       # requisitos
  ├── nginx/      # configuração do proxy reverso
  ├── docker-compose.yml
  ├── README.md
  └── CHANGELOG.md
  ```

## Documentação

Os requisitos completos estão em [docs/requirements.md](docs/requirements.md):

- [Papéis](docs/requirements.md#papéis) e [fluxo principal](docs/requirements.md#fluxo-principal)
- [Módulos](docs/requirements.md#módulos): membros, treinos e frequência
- [Requisitos funcionais (RF01–RF18)](docs/requirements.md#requisitos-funcionais)
- [Requisitos não funcionais (RNF01–RNF16)](docs/requirements.md#requisitos-não-funcionais)
- [Requisitos de domínio (RD01–RD12)](docs/requirements.md#requisitos-de-domínio)

## Escopo por etapa

O que será entregue em cada etapa fica registrado no [CHANGELOG](CHANGELOG.md).

| Etapa | Foco | Requisitos |
| --- | --- | --- |
| Parte 1 | Base da API, autenticação e gestão de membros | RF01–RF07, RNF01–RNF10, RNF14, RD01, RD05, RD09–RD11 |
| Parte 2 | Treinos e check-in | RF08–RF14, RD02, RD03, RD06–RD08 |
| Parte 3 | Relatórios, cache, escalabilidade e deploy | RF15–RF18, RNF11–RNF13, RNF15, RNF16, RD04, RD12 |
