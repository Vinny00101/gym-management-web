# Changelog

## [0.2.0] - 2026-11-27

Treinos e check-ins da Parte 2, construídos sobre a arquitetura reorganizada do backend (RF08–RF14, RD02, RD03, RD06–RD08 e RD11).

### Arquitetura e configuração

- Documentação da arquitetura projeto.
- Módulos de infraestrutura em `infra/` e cache Redis com fallback em memória nos testes
- Observabilidade centralizada em `app.observability.ts` 
- Pipeline HTTP centralizada em `app.config.ts` (`setupApp()` e `configureHttp()`), com helmet, Swagger gerado por factory, validação, interceptadores e filtro de erro compartilhados entre `main.ts` e os testes e2e
- Rotas versionadas sob `/api/v1`, Swagger em `/api/docs` e health check estável entre versões
- Módulos por domínio em `modules/`: `auth`, `members`, `staff`, `workout-plans` e `check-ins`
- Mensagens de erro e metadados do Swagger padronizados em português
- Documentação enxuta: removidos o template de PR padrão e o checklist da Parte 2, cujo histórico passa a ser registrado neste changelog

### Parte 2: treinos e check-in

- Modelagem e migração de `WorkoutPlan`, `WorkoutDivision`, `Exercise` e `CheckIn` (P2-01, #34)
- Criação de plano de treino com divisões (RF08, P2-02, #35)
- Inclusão de exercícios nas divisões (RF09, P2-03, #36)
- Atribuição de plano ao membro sem remover planos anteriores (RF10/RD07, P2-04, #37)
- Edição transacional de plano, divisões e exercícios (RF11/RD08, P2-05, #38)
- Consulta do treino atual com controle de posse (RF12/RD06/RD11, P2-06, #39)
- Check-in de membro ativo com data local e unicidade diária (RF13/RD02/RD03, P2-07, #40)
- Consulta paginada do histórico com filtros de período e posse (RF14/RD11, P2-08, #41)
- Testes unitários, e2e, documentação Swagger e fluxo ponta a ponta da Parte 2 (#42)

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
