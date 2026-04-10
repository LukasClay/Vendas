# 📱 MOBILE E RESPONSIVIDADE - Consolidado

Documentação sobre auditoria de responsividade mobile e otimizações.

---

## Auditoria de Responsividade Mobile - Painel Admin

### Vendas.tsx

- ✅ Tabela desktop (hidden md:block) + cards mobile (md:hidden) - OK
- ✅ Modal de edição: max-w-lg com p-4, max-h-[90vh] overflow-y-auto - OK
- ✅ Filtros: grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 - OK
- ✅ Botões Editar/Excluir nos cards mobile - OK
- ⚠️ **PRECISA DE FIX**: Inputs no modal: fontSize 14px - DEVE ser 16px para evitar zoom no iOS

### Vendedores.tsx

- ⚠️ Edição inline com flex-wrap - pode ficar apertado no mobile
- ⚠️ Reset senha inline - pode ficar apertado
- ⚠️ Botão "Novo Funcionário" pode sobrepor título

### Dashboard (admin/page.tsx)

- ⚠️ Precisa verificar tabela Status dos Trabalhos no mobile
- ⚠️ Cards KPI em grid - verificar

### Produtos

- ⚠️ Precisa verificar

---

## Mobile-First Testing Checklist

- [ ] Testar em iPhone SE (pequeno)
- [ ] Testar em iPhone 12 Pro (médio)
- [ ] Testar em Samsung Galaxy S21 (Android padrão)
- [ ] Testar em Slow 3G connection
- [ ] Verificar que inputs têm 16px+ para evitar zoom iOS
- [ ] Verificar breakpoints Tailwind (sm, md, lg, xl, 2xl)

---

_Documento de responsividade compilado em 27/03/2026_
