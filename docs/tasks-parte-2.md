# Tarefas da Parte 2: treinos e check-in

Escopo: RF08–RF14, RD02, RD03, RD06–RD08 e RD11.

- [x] **P2-01 — Modelagem e migração**: entidades de plano, divisões, exercícios e check-ins, incluindo a restrição única por membro e dia local ([#34](https://github.com/Vinny00101/gym-management-web/issues/34)).
- [x] **P2-02 — Criar plano com divisões (RF08)**: instrutor associado cria o plano e suas divisões ([#35](https://github.com/Vinny00101/gym-management-web/issues/35)).
- [x] **P2-03 — Adicionar exercícios (RF09)**: incluir exercícios nas divisões existentes ([#36](https://github.com/Vinny00101/gym-management-web/issues/36)).
- [x] **P2-04 — Atribuir plano (RF10/RD07)**: tornar um plano o treino atual sem excluir planos anteriores ([#37](https://github.com/Vinny00101/gym-management-web/issues/37)).
- [x] **P2-05 — Editar plano (RF11/RD08)**: atualizar plano, divisões e exercícios atomicamente ([#38](https://github.com/Vinny00101/gym-management-web/issues/38)).
- [x] **P2-06 — Consultar treino atual (RF12/RD06/RD11)**: membro e instrutor autorizado consultam plano, divisões e exercícios ([#39](https://github.com/Vinny00101/gym-management-web/issues/39)).
- [x] **P2-07 — Registrar check-in (RF13/RD02/RD03)**: membro ativo faz um check-in por dia local; duplicidade é protegida pelo banco ([#40](https://github.com/Vinny00101/gym-management-web/issues/40)).
- [x] **P2-08 — Consultar histórico (RF14/RD11)**: admin, instrutor e membro consultam registros conforme posse, período e paginação ([#41](https://github.com/Vinny00101/gym-management-web/issues/41)).
- [x] **Fluxo integrado**: verificar criação do plano, exercícios, atribuição, consulta do treino, check-in e histórico dos três papéis em teste e2e ([#42](https://github.com/Vinny00101/gym-management-web/issues/42)).

## Verificação

- [x] Respostas e erros seguem o formato centralizado da API sem expor dados sensíveis.
- [x] Rotas da Parte 2 documentadas no Swagger com papéis, códigos HTTP e exemplos.
- [x] Testes unitários, e2e, lint e build executados.
