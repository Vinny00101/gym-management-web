# Módulo `workout-plans`

## Responsabilidade

RF08–RF12: criação de plano de treino com divisões e exercícios pelo instrutor, e consulta do plano atual pelo membro.

## Rotas

- `POST /api/v1/workout-plans` — somente trainer

## Regras de negócio

- Um plano por membro; a criação atualiza `User.activePlanId`.
- O instrutor só pode criar plano para membros sob sua responsabilidade — checagem de posse no service (RNF07/RD11).
- Divisões e exercícios são validados pelo DTO colocalizado em `dto/`.

## Dependências

- `IdentityModule` (`OwnershipService`)
- `PrismaService`

## Fora do escopo

Check-ins (RF13–RF14) e relatórios (RF15–RF18), que terão módulos próprios.
