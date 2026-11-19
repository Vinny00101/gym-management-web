# Changelog

Todas as mudanças relevantes do projeto são registradas aqui.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa [Versionamento Semântico](https://semver.org/lang/pt-BR/). Os códigos (RF, RNF, RD) apontam para os [requisitos](docs/requirements.md). As entradas derivam dos commits, que seguem [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/) — veja a [convenção de commits](README.md#convenção-de-commits) no README.

## [Não lançado]

### Parte 1: base da API, autenticação e gestão de membros (planejado)

Marque cada item com `[x]` quando ele for implementado. Ao fechar a etapa, mova esta seção para `## [0.1.0] - AAAA-MM-DD`.

#### Adicionado

**Estrutura e infraestrutura**

- [x] Estrutura do repositório único (`backend/`, `frontend/`, `docs/`)
- [x] Projeto NestJS 12 em `backend/` com TypeScript, oxlint, Prettier e Vitest
- [x] `.env.example` com as variáveis da API
- [x] Validação das variáveis de ambiente na inicialização com `@nestjs/config`
- [x] Docker Compose de desenvolvimento com PostgreSQL e Redis
- [x] Prisma configurado com PostgreSQL ([RNF09](docs/requirements.md#requisitos-não-funcionais))
- [x] Migrações iniciais: tabela de usuários (admin, trainer, member) com e-mail único, situação do membro e instrutor responsável ([RNF04](docs/requirements.md#requisitos-não-funcionais), RD01, RD05, RD10)
- [ ] Seed do primeiro administrador com credenciais vindas de variáveis de ambiente (RF02)
- [ ] `helmet` e `GET /health` com `@nestjs/terminus`
- [ ] Swagger em `/api/docs` com `@nestjs/swagger`, documentando os endpoints desta etapa (RNF16)

**Pipeline de middlewares** ([RNF01](docs/requirements.md#requisitos-não-funcionais))

- [x] Logging de requisições com request id, método, rota, status e tempo de resposta (RNF10)
- [ ] Sanitização e validação de entrada por esquema (RNF08)
- [ ] Autenticação por JWT com expiração curta, algoritmo fixo e segredo vindo de variável de ambiente (RNF06)
- [ ] Autorização por papel e por posse do recurso (RNF07)
- [x] Tratamento de erros centralizado com formato JSON único (código, mensagem, request id) e sem detalhes internos para o cliente (RNF02, RNF03)
- [ ] API stateless, sem sessão em memória (RNF14)

**Autenticação**

- [ ] `POST /auth/login`: login com e-mail e senha, retornando access token de 15 minutos e refresh token em cookie `httpOnly` ([RF01](docs/requirements.md#requisitos-funcionais), RNF06)
- [ ] `POST /auth/refresh`: emite novo access token a partir do refresh token, cujo hash fica no banco (RNF14)
- [ ] `POST /auth/logout`: revoga o refresh token e limpa o cookie
- [ ] Senhas armazenadas com `argon2` (RNF05)
- [ ] Limite de tentativas no login com `@nestjs/throttler`
- [ ] Registro de falhas de login e acessos negados como eventos de segurança (RNF10)

**Gestão de usuários e membros**

- [ ] Cadastro de instrutores e administradores pelo admin ([RF02](docs/requirements.md#requisitos-funcionais))
- [ ] Cadastro de membros pelo admin, sempre começando como ativo (RF03, RD01, RD09)
- [ ] Listagem de membros com filtro por situação; o instrutor vê só os seus (RF04)
- [ ] Edição de dados e alteração de situação (ativo, inativo, suspenso) pelo admin (RF05, RD09)
- [ ] Associação e troca do instrutor responsável, um por membro (RF06, RD05)
- [ ] Consulta do próprio perfil e do instrutor pelo membro (RF07, RD11)

#### Fora desta etapa

Treinos e check-in ficam para a Parte 2; relatórios, cache, NGINX, Docker Compose completo e CI ficam para a Parte 3. O frontend em Vue é um extra e só começa depois que a API da etapa estiver funcionando. Veja o [escopo por etapa](README.md#escopo-por-etapa).
