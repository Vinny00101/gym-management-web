# Módulo `staff`

## Responsabilidade

RF02: cadastro de instrutores e administradores feito pelo admin.

## Rotas

- `POST /api/v1/staff` — somente admin

## Regras de negócio

- E-mail único e normalizado; conflito devolve 409 com `code: "CONFLICT"`.
- Papel e situação vêm do DTO validado; a senha é gravada como hash pelo `PasswordService`.

## Dependências

- `PasswordModule` (auth) para hash de senha
- `PrismaService`
- DTO colocalizado em `dto/`

## Fora do escopo

Listagem/edição de staff, autenticação e gestão de membros.
