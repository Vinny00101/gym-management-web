# Módulo `check-ins`

## Responsabilidade

RF13: registrar a entrada de membros ativos, limitando a um check-in por dia em `America/Sao_Paulo`.

## Rotas

- `GET /api/v1/check-ins` — consulta histórico por papel, membro e período.
- `POST /api/v1/check-ins` — registra check-in de membro ou por administrador.

## Regras de negócio

- Membros veem apenas o próprio histórico; instrutores, o histórico dos seus membros; administradores, todos os registros.
- Sem `from`/`to`, o período cobre os últimos 30 dias locais, incluindo hoje; a paginação padrão é `page=1`, `pageSize=20`, máximo 100.
- Membros só registram a própria entrada; administradores informam `memberId`.
- Apenas membros ativos podem fazer check-in.
- `localDate` representa a data civil de São Paulo e a restrição única do banco impede duplicidade, inclusive em requisições concorrentes.
- Conflitos `P2002` são convertidos pelo filtro global em `409 CONFLICT`.

## Dependências

- `PrismaService`
