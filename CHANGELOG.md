# Changelog

Todas as mudanças relevantes do projeto são registradas aqui.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa [Versionamento Semântico](https://semver.org/lang/pt-BR/). Os códigos (RF, RNF, RD) apontam para os [requisitos](docs/requirements.md). As entradas derivam dos commits, que seguem [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/) — veja a [convenção de commits](README.md#convenção-de-commits) no README.

## [Não lançado]

### Refatoração da arquitetura (planejada)

#### Adicionado

- [ ] Documentação da arquitetura alvo, da task [#45](https://github.com/Vinny00101/gym-management-web/issues/45) e do plano de migração em PRs ([docs/architecture.md](docs/architecture.md))

### Parte 2: treinos e check-in (planejado)

#### Adicionado

- [x] Migração com entidades de treinos e check-in: `WorkoutPlan`, `WorkoutDivision`, `Exercise` e `CheckIn`, enum `DivisionType`, plano atual por membro via `User.activePlanId` e restrição de um check-in por dia ([RD02](docs/requirements.md#requisitos-de-domínio), RD03, RD07, RD08, [RNF04](docs/requirements.md#requisitos-não-funcionais), RNF12)

### Parte 1: base da API, autenticação e gestão de membros (planejado)

Marque cada item com `[x]` quando ele for implementado. Ao fechar a etapa, mova esta seção para `## [0.1.0] - AAAA-MM-DD`.

#### Adicionado

**Estrutura e infraestrutura**

- [x] Estrutura do repositório único (`backend/`, `frontend/`, `docs/`)
- [x] Organização de `backend/src` por responsabilidade: `controllers/`, `services/` e recursos compartilhados em `common/` (`decorators/`, `dto/`, `guards/`); controller e service de demonstração removidos
- [x] Projeto NestJS 12 em `backend/` com TypeScript, oxlint, Prettier e Vitest
- [x] `.env.example` com as variáveis da API
- [x] Validação das variáveis de ambiente na inicialização com `@nestjs/config`
- [x] Docker Compose de desenvolvimento com PostgreSQL e Redis
- [x] Prisma configurado com PostgreSQL ([RNF09](docs/requirements.md#requisitos-não-funcionais))
- [x] Migrações iniciais: tabela de usuários (admin, trainer, member) com e-mail único, situação do membro e instrutor responsável ([RNF04](docs/requirements.md#requisitos-não-funcionais), RD01, RD05, RD10)
- [x] Seed do primeiro administrador com credenciais vindas de variáveis de ambiente (RF02), usando o mesmo `PasswordService` da API
- [x] `helmet` e `GET /health` com `@nestjs/terminus`
- [x] Swagger em `/api/docs` com `@nestjs/swagger`, documentando os endpoints desta etapa (RNF16)

**Pipeline de middlewares** ([RNF01](docs/requirements.md#requisitos-não-funcionais))

- [x] Logging de requisições com request id, método, rota, status e tempo de resposta (RNF10)
- [x] Sanitização e validação de entrada por esquema (RNF08)
- [x] Autenticação por JWT com expiração curta (15 min), HS256 fixo e segredo vindo de `JWT_SECRET` (RNF06)
- [x] Autorização por papel (`@Roles()` + `RolesGuard`) e por posse do recurso (`OwnershipService`, [padrão documentado](docs/ownership-pattern.md)) (RNF07)
- [x] Tratamento de erros centralizado com formato JSON único (código, mensagem, request id) e sem detalhes internos para o cliente (RNF02, RNF03)
- [x] API stateless, sem sessão em memória (RNF14): access token no cliente e refresh token em cookie + hash no banco

**Autenticação**

- [x] `POST /auth/login`: login com e-mail e senha, retornando access token de 15 minutos e refresh token em cookie `httpOnly` ([RF01](docs/requirements.md#requisitos-funcionais), RNF06)
- [x] `POST /auth/refresh`: emite novo access token e rotaciona o refresh token, cujo hash SHA-256 fica no banco (RNF14)
- [x] `POST /auth/logout`: revoga o refresh token e limpa o cookie
- [x] `PasswordService` com `hash()` e `verify()` usando `argon2`, usado pelo login e pelo seed (RNF05)
- [x] Limite de 5 tentativas de login por minuto por IP com `@nestjs/throttler` (429 com `TOO_MANY_REQUESTS`)
- [x] Registro de falhas de login e acessos negados (401/403) como eventos de segurança com e-mail, IP e request id, sem senha (RNF10)
- [x] `@Public()`, `@CurrentUser()`, guard global de JWT e interceptor que impede hash de senha/refresh token em respostas
- [x] Testes unitários e e2e de login, guards, posse, rotação de refresh token, hash de senha e eventos de segurança

**Gestão de usuários e membros**

- [x] Cadastro de instrutores e administradores pelo admin ([RF02](docs/requirements.md#requisitos-funcionais))
- [x] Cadastro de membros pelo admin, sempre começando como ativo (RF03, RD01, RD09)
- [x] Listagem de membros com filtro por situação; o instrutor vê só os seus (RF04)
- [x] Edição de dados e alteração de situação (ativo, inativo, suspenso) pelo admin (RF05, RD09)
- [x] Associação e troca do instrutor responsável, um por membro (RF06, RD05)
- [x] Consulta do próprio perfil e do instrutor pelo membro (RF07, RD11)

#### Fora desta etapa

Treinos e check-in ficam para a Parte 2; relatórios, cache, NGINX, Docker Compose completo e CI ficam para a Parte 3. O frontend em Vue é um extra e só começa depois que a API da etapa estiver funcionando. Veja o [escopo por etapa](README.md#escopo-por-etapa).
