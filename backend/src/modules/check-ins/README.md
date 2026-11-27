# Módulo `check-ins`

## Responsabilidade

RF13: registrar a entrada de membros ativos, limitando a um check-in por dia em `America/Sao_Paulo`.

## Rotas

- `POST /api/v1/check-ins` — registra check-in de membro ou por administrador.

## Regras de negócio

- Membros só registram a própria entrada; administradores informam `memberId`.
- Apenas membros ativos podem fazer check-in.
- `localDate` representa a data civil de São Paulo e a restrição única do banco impede duplicidade, inclusive em requisições concorrentes.
- Conflitos `P2002` são convertidos pelo filtro global em `409 CONFLICT`.

## Dependências

- `PrismaService`
