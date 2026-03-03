-- Ejecutar en Supabase SQL Editor
-- Objetivo: agregar campos solicitados para pedidos WooCommerce

begin;

alter table public.pedidos add column if not exists nombre_cliente text;
alter table public.pedidos add column if not exists telefono_cliente text;
alter table public.pedidos add column if not exists email_cliente text;
alter table public.pedidos add column if not exists observaciones text;

-- Alias opcionales con los nombres exactos que se piden en reportes
alter table public.pedidos add column if not exists direccion_envio text;
alter table public.pedidos add column if not exists distrito text;
alter table public.pedidos add column if not exists provincia text;

update public.pedidos
set
  direccion_envio = coalesce(direccion_envio, direccion_cliente),
  distrito = coalesce(distrito, distrito_cliente),
  provincia = coalesce(provincia, provincia_cliente)
where
  direccion_envio is null
  or distrito is null
  or provincia is null;

commit;

-- Vista recomendada para explotar pedidos con items (productos/cantidad/sku)
create or replace view public.v_pedidos_woocommerce as
select
  p.id,
  p.empresa_id,
  case when p.numero ~ '^[0-9]+$' then p.numero::bigint else null end as order_id,
  p.numero,
  p.id_orden,
  p.id_externo,
  p.dni_cliente as dni,
  p.fecha_pedido,
  p.estado,
  p.nombre_cliente,
  p.telefono_cliente as telefono,
  p.email_cliente as email,
  coalesce(p.direccion_envio, p.direccion_cliente) as direccion_envio,
  coalesce(p.distrito, p.distrito_cliente) as distrito,
  coalesce(p.provincia, p.provincia_cliente) as provincia,
  p.total,
  p.metodo_pago,
  p.observaciones,
  coalesce(string_agg(coalesce(pr.nombre, pi.sku_producto, 'SIN_PRODUCTO'), ' | ' order by pi.id), '') as productos,
  coalesce(string_agg(coalesce(pi.cantidad::text, '0'), ', ' order by pi.id), '') as cantidad,
  coalesce(string_agg(coalesce(pi.sku_producto, 'N/A'), ', ' order by pi.id), '') as sku
from public.pedidos p
left join public.pedido_items pi on pi.pedido_id = p.id
left join public.productos pr on pr.id = pi.producto_id
group by p.id;
