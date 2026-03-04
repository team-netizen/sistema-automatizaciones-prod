-- [SECURITY FIX] RLS hardening for multi-tenant SaaS inventory.
-- Applies tenant isolation as a second defense layer beyond API guards.

begin;

create or replace function public.app_current_empresa_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.empresa_id::text
  from public.perfiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.app_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.rol = 'super_admin'
  );
$$;

revoke all on function public.app_current_empresa_id() from public;
revoke all on function public.app_is_super_admin() from public;
grant execute on function public.app_current_empresa_id() to authenticated;
grant execute on function public.app_is_super_admin() to authenticated;

-- Helper block for tables with empresa_id column.
do $$
declare
  table_name text;
  target_tables text[] := array[
    'empresas',
    'sucursales',
    'productos',
    'pedidos',
    'movimientos_stock',
    'stock_por_sucursal',
    'transferencias_stock',
    'integraciones_canal',
    'canales_venta',
    'alertas_generadas',
    'alertas_configuracion',
    'notificaciones',
    'modulos_empresa'
  ];
begin
  foreach table_name in array target_tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('alter table public.%I force row level security', table_name);

      execute format('drop policy if exists %I on public.%I', 'tenant_select_policy', table_name);
      execute format('drop policy if exists %I on public.%I', 'tenant_write_policy', table_name);

      if table_name = 'empresas' then
        execute format($sql$
          create policy %I on public.%I
          for select
          to authenticated
          using (
            public.app_is_super_admin()
            or id::text = public.app_current_empresa_id()
          )
        $sql$, 'tenant_select_policy', table_name);

        execute format($sql$
          create policy %I on public.%I
          for all
          to authenticated
          using (
            public.app_is_super_admin()
            or id::text = public.app_current_empresa_id()
          )
          with check (
            public.app_is_super_admin()
            or id::text = public.app_current_empresa_id()
          )
        $sql$, 'tenant_write_policy', table_name);
      else
        execute format($sql$
          create policy %I on public.%I
          for select
          to authenticated
          using (
            public.app_is_super_admin()
            or empresa_id::text = public.app_current_empresa_id()
          )
        $sql$, 'tenant_select_policy', table_name);

        execute format($sql$
          create policy %I on public.%I
          for all
          to authenticated
          using (
            public.app_is_super_admin()
            or empresa_id::text = public.app_current_empresa_id()
          )
          with check (
            public.app_is_super_admin()
            or empresa_id::text = public.app_current_empresa_id()
          )
        $sql$, 'tenant_write_policy', table_name);
      end if;
    end if;
  end loop;
end $$;

-- perfiles: allow self, same-tenant access, and super admin.
do $$
begin
  if to_regclass('public.perfiles') is not null then
    alter table public.perfiles enable row level security;
    alter table public.perfiles force row level security;

    drop policy if exists perfiles_select_policy on public.perfiles;
    drop policy if exists perfiles_write_policy on public.perfiles;

    create policy perfiles_select_policy
    on public.perfiles
    for select
    to authenticated
    using (
      public.app_is_super_admin()
      or id = auth.uid()
      or empresa_id::text = public.app_current_empresa_id()
    );

    create policy perfiles_write_policy
    on public.perfiles
    for all
    to authenticated
    using (
      public.app_is_super_admin()
      or id = auth.uid()
      or empresa_id::text = public.app_current_empresa_id()
    )
    with check (
      public.app_is_super_admin()
      or id = auth.uid()
      or empresa_id::text = public.app_current_empresa_id()
    );
  end if;
end $$;

-- pedido_items: derive tenant through pedido parent.
do $$
begin
  if to_regclass('public.pedido_items') is not null then
    alter table public.pedido_items enable row level security;
    alter table public.pedido_items force row level security;

    drop policy if exists pedido_items_select_policy on public.pedido_items;
    drop policy if exists pedido_items_write_policy on public.pedido_items;

    create policy pedido_items_select_policy
    on public.pedido_items
    for select
    to authenticated
    using (
      public.app_is_super_admin()
      or exists (
        select 1
        from public.pedidos p
        where p.id = pedido_items.pedido_id
          and p.empresa_id::text = public.app_current_empresa_id()
      )
    );

    create policy pedido_items_write_policy
    on public.pedido_items
    for all
    to authenticated
    using (
      public.app_is_super_admin()
      or exists (
        select 1
        from public.pedidos p
        where p.id = pedido_items.pedido_id
          and p.empresa_id::text = public.app_current_empresa_id()
      )
    )
    with check (
      public.app_is_super_admin()
      or exists (
        select 1
        from public.pedidos p
        where p.id = pedido_items.pedido_id
          and p.empresa_id::text = public.app_current_empresa_id()
      )
    );
  end if;
end $$;

-- transferencia_items: derive tenant through transferencia parent.
do $$
begin
  if to_regclass('public.transferencia_items') is not null then
    alter table public.transferencia_items enable row level security;
    alter table public.transferencia_items force row level security;

    drop policy if exists transferencia_items_select_policy on public.transferencia_items;
    drop policy if exists transferencia_items_write_policy on public.transferencia_items;

    create policy transferencia_items_select_policy
    on public.transferencia_items
    for select
    to authenticated
    using (
      public.app_is_super_admin()
      or exists (
        select 1
        from public.transferencias_stock ts
        where ts.id = transferencia_items.transferencia_id
          and ts.empresa_id::text = public.app_current_empresa_id()
      )
    );

    create policy transferencia_items_write_policy
    on public.transferencia_items
    for all
    to authenticated
    using (
      public.app_is_super_admin()
      or exists (
        select 1
        from public.transferencias_stock ts
        where ts.id = transferencia_items.transferencia_id
          and ts.empresa_id::text = public.app_current_empresa_id()
      )
    )
    with check (
      public.app_is_super_admin()
      or exists (
        select 1
        from public.transferencias_stock ts
        where ts.id = transferencia_items.transferencia_id
          and ts.empresa_id::text = public.app_current_empresa_id()
      )
    );
  end if;
end $$;

commit;
