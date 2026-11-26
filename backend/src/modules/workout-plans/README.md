# Módulo `workout-plans`

## Responsabilidade

RF08–RF12: criação e alteração de planos de treino com divisões e exercícios pelo instrutor, e consulta do plano atual pelo membro.

## Rotas

- `POST /api/v1/workout-plans` — cria um plano (somente trainer)
- `POST /api/v1/workout-plans/:planId/assign` — atribui plano ao membro (somente trainer)
- `GET /api/v1/members/:memberId/workout-plan` — consulta o treino atual (member ou trainer responsável)
- `PATCH /api/v1/workout-plans/:planId` — edita plano (somente trainer)
- `POST /api/v1/workout-plans/:planId/divisions` — adiciona uma divisão (somente trainer)
- `POST /api/v1/workout-plans/:planId/divisions/:divisionId/exercises` — adiciona um exercício (somente trainer)

## Regras de negócio

- A criação inicial pode conter divisões; este módulo permite adicionar divisões e exercícios sem alterar `User.activePlanId`.
- A atribuição atualiza `User.activePlanId` em transação; reatribuir o mesmo plano não gera nova escrita.
- A data da atribuição atual é armazenada em `User.activePlanAssignedAt` e retornada junto ao treino atual.
- Ao enviar `divisions`, a lista substitui as divisões existentes; IDs enviados são preservados e divisões omitidas são removidas. Em cada divisão, `exercises` omitido preserva os exercícios atuais e uma lista enviada substitui o conjunto, preservando IDs enviados.
- A edição é atômica e não altera `User.activePlanId`.
- O instrutor só pode criar plano para membros sob sua responsabilidade — checagem de posse no service (RNF07/RD11).
- Divisões e exercícios são validados pelo DTO colocalizado em `dto/`.

## Dependências

- `IdentityModule` (`OwnershipService`)
- `PrismaService`

## Fora do escopo

Check-ins (RF13–RF14) e relatórios (RF15–RF18), que terão módulos próprios.
