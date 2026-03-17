# Auditoria de Responsividade Mobile - Painel Admin

## Vendas.tsx
- Tabela desktop (hidden md:block) + cards mobile (md:hidden) - OK
- Modal de edição: max-w-lg com p-4, max-h-[90vh] overflow-y-auto - OK
- Filtros: grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 - OK
- Botões Editar/Excluir nos cards mobile - OK
- Inputs no modal: fontSize 14px - PRECISA ser 16px para evitar zoom no iOS

## Vendedores.tsx
- Edição inline com flex-wrap - pode ficar apertado no mobile
- Reset senha inline - pode ficar apertado
- Botão "Novo Funcionário" pode sobrepor título

## Dashboard (admin/page.tsx)
- Precisa verificar tabela Status dos Trabalhos no mobile
- Cards KPI em grid - verificar

## Produtos
- Precisa verificar
