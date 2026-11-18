# Requisitos: API de Gestão de Academia

Voltar para o [README](../README.md).

## Visão geral

### Papéis

| Papel | O que faz no sistema |
| --- | --- |
| admin | Cadastra membros e instrutores, altera a situação dos membros, associa instrutores e consulta os indicadores da academia |
| trainer | Cria e edita planos de treino dos membros associados a ele e acompanha a frequência desses membros |
| member | Consulta o próprio treino atual, faz check-in e vê o próprio histórico de frequência |

### Fluxo principal

1. O administrador cadastra um membro.
2. O administrador associa um instrutor ao membro.
3. O instrutor cria um plano de treino personalizado para o membro.
4. O membro faz check-in ao chegar na academia.
5. O sistema registra a frequência e acompanha a assiduidade do membro.
6. O administrador consulta indicadores de uso da academia.

### Módulos

**Gestão de membros.** Cadastro e gerenciamento de membros, associação com instrutor, situação do membro (ativo, inativo ou suspenso), consulta do histórico de frequência e visualização do treino atual.

**Gestão de treinos.** O instrutor cria planos de treino divididos por dias ou grupos musculares, com exercícios, séries e repetições, e atribui o plano ao membro. O histórico de alterações dos planos fica como funcionalidade opcional.

**Controle de frequência.** Registro de entrada por check-in, histórico de visitas, frequência diária e mensal, identificação de membros sem frequência recente e relatório dos horários de maior movimento.

## Requisitos

Os requisitos se dividem em três tabelas: funcionais (RF), não funcionais (RNF) e de domínio (RD), que são as regras vindas do funcionamento de uma academia. Valores como "30 dias" ou "15 minutos" são propostas e podem ser ajustados pelo grupo.

### Requisitos funcionais

| Código | Requisito | Descrição | Papel | Prioridade |
| --- | --- | --- | --- | --- |
| RF01 | Autenticar usuário | O usuário faz login com e-mail e senha e recebe um token de acesso | Todos | Alta |
| RF02 | Cadastrar usuário da equipe | O administrador cadastra instrutores e outros administradores | admin | Alta |
| RF03 | Cadastrar membro | O administrador cadastra um membro com dados pessoais e credenciais de acesso | admin | Alta |
| RF04 | Consultar membros | Listar membros com filtro por situação; o instrutor vê apenas os membros associados a ele | admin, trainer | Alta |
| RF05 | Atualizar membro | Editar dados do membro e alterar sua situação (ativo, inativo, suspenso) | admin | Alta |
| RF06 | Associar instrutor | Vincular um instrutor responsável a um membro ou trocar o instrutor atual | admin | Alta |
| RF07 | Consultar próprio perfil | O membro consulta os próprios dados e o instrutor responsável | member | Média |
| RF08 | Criar plano de treino | O instrutor cria um plano com nome, objetivo e divisões (por dia ou grupo muscular) | trainer | Alta |
| RF09 | Adicionar exercícios ao plano | Incluir exercícios em cada divisão do plano, com séries e repetições | trainer | Alta |
| RF10 | Atribuir plano ao membro | Definir o plano como treino atual de um membro associado ao instrutor | trainer | Alta |
| RF11 | Editar plano de treino | Alterar divisões e exercícios de um plano existente | trainer | Média |
| RF12 | Consultar treino atual | Ver o plano de treino ativo de um membro | member, trainer | Alta |
| RF13 | Registrar check-in | Registrar a entrada do membro na academia com data e hora | member, admin | Alta |
| RF14 | Consultar histórico de check-ins | Ver as visitas de um membro por período; o membro vê só as próprias e o instrutor só as dos seus membros | Todos | Alta |
| RF15 | Consultar frequência diária e mensal | Total de check-ins por dia e por mês na academia | admin | Média |
| RF16 | Listar membros sem frequência | Listar membros ativos sem check-in recente | admin, trainer | Média |
| RF17 | Relatório de horários de pico | Quantidade de check-ins por faixa de horário | admin | Média |
| RF18 | Histórico de alterações do plano | Registrar quem alterou um plano e quando | trainer, admin | Baixa (opcional) |

### Requisitos não funcionais

| Código | Categoria | Descrição | Seção do enunciado |
| --- | --- | --- | --- |
| RNF01 | Arquitetura | As requisições passam por um pipeline de middlewares na ordem: logging, sanitização, autenticação, autorização, validação, handler e tratamento de erros | 2.1 |
| RNF02 | Respostas | Todos os erros seguem um formato JSON único com código, mensagem e request id, usando o código HTTP adequado (400, 401, 403, 404, 409, 422, 500) | 2.2 |
| RNF03 | Segurança | A API não expõe stack traces, consultas SQL ou detalhes internos ao cliente; esses dados vão apenas para o log | 2.2, 2.4 |
| RNF04 | Persistência | Os recursos principais são armazenados em banco de dados, com o esquema versionado por migrações | 2.3 |
| RNF05 | Segurança (ASVS V6) | Senhas são armazenadas com hash forte (bcrypt ou argon2), nunca em texto puro | 2.4 |
| RNF06 | Segurança (ASVS V9) | O token JWT tem expiração curta (proposta: 15 minutos), algoritmo fixo e segredo lido de variável de ambiente | 2.4 |
| RNF07 | Segurança (ASVS V8) | Cada endpoint verifica o papel do usuário e a posse do recurso (o instrutor só acessa seus membros; o membro só acessa os próprios dados) | 2.4 |
| RNF08 | Segurança (ASVS V1/V2) | Toda entrada passa por validação de esquema e sanitização antes de chegar à regra de negócio | 2.1, 2.4 |
| RNF09 | Segurança | O acesso ao banco usa ORM ou queries parametrizadas, sem concatenação de SQL | 2.4 |
| RNF10 | Logging (ASVS V16) | Todas as requisições são registradas com request id, método, rota, status e tempo de resposta; falhas de login e acessos negados são registrados como eventos de segurança | 2.1, 2.4 |
| RNF11 | Desempenho (cache) | O treino atual do membro fica em cache compartilhado (Redis), invalidado quando o plano é editado; os indicadores do admin usam cache com TTL (proposta: 5 minutos) | 2.5 |
| RNF12 | Desempenho (banco) | A tabela de check-ins tem índices em membro e data, e os relatórios são calculados com agregações no banco | 2.5 |
| RNF13 | Escalabilidade | A API roda em pelo menos duas instâncias atrás de um proxy reverso NGINX que distribui as requisições | 2.6 |
| RNF14 | Escalabilidade | A API é stateless: nenhuma instância guarda sessão em memória, para que qualquer uma atenda qualquer requisição | 2.6 |
| RNF15 | Deploy | O ambiente sobe com Docker Compose (API, banco, Redis e NGINX), e um pipeline de CI no GitHub Actions roda os testes e o build | 2.7 |
| RNF16 | Documentação | O repositório tem README com instruções de execução local e a documentação dos endpoints | 2.8, 2.9 |

### Requisitos de domínio

| Código | Regra | RF relacionado |
| --- | --- | --- |
| RD01 | Todo membro tem uma situação: ativo, inativo ou suspenso. Todo membro novo começa como ativo | RF03, RF05 |
| RD02 | Apenas membros com situação ativa podem fazer check-in | RF13 |
| RD03 | Cada membro pode fazer no máximo um check-in por dia | RF13 |
| RD04 | Um membro ativo sem check-in há mais de 30 dias aparece na lista de membros sem frequência. A situação dele só muda se o administrador alterar | RF16 |
| RD05 | Cada membro tem no máximo um instrutor responsável por vez | RF06 |
| RD06 | O instrutor só cria, edita e atribui treinos para membros associados a ele | RF08, RF10, RF11 |
| RD07 | Cada membro tem no máximo um plano de treino ativo. Atribuir um novo plano desativa o anterior, que continua guardado | RF10, RF12 |
| RD08 | Um plano tem pelo menos uma divisão, e cada exercício tem séries e repetições maiores que zero | RF08, RF09 |
| RD09 | Apenas o administrador cadastra membros e altera a situação deles | RF03, RF05 |
| RD10 | O e-mail é único entre todos os usuários do sistema | RF02, RF03 |
| RD11 | O membro só acessa os próprios dados, treino e histórico | RF07, RF12, RF14 |
| RD12 | O relatório de horários de pico agrupa os check-ins em faixas de uma hora | RF17 |
