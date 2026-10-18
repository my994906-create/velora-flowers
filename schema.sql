-- Velora Flowers — Supabase / PostgreSQL şeması
-- Supabase Dashboard > SQL Editor içinde çalıştırın.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.create_profile_for_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_velora on auth.users;
create trigger on_auth_user_created_velora
after insert on auth.users
for each row execute function public.create_profile_for_user();

create or replace function public.is_velora_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  price numeric(10,2) not null check (price > 0),
  description text not null check (length(trim(description)) between 1 and 3000),
  image_url text check (image_url is null or image_url ~ '^https?://'),
  category text not null check (category in ('bukeler', 'guller', 'orkideler', 'bitkiler', 'hediyeler')),
  stock integer not null default 0 check (stock >= 0),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  customer_name text not null check (length(trim(customer_name)) between 1 and 120),
  email text not null,
  phone text not null check (length(trim(phone)) between 3 and 40),
  address text not null check (length(trim(address)) between 1 and 1200),
  total_amount numeric(10,2) not null check (total_amount > 0),
  status text not null default 'alindi' check (status in ('alindi', 'hazirlaniyor', 'kargoda', 'tamamlandi', 'iptal')),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity between 1 and 20),
  unit_price numeric(10,2) not null check (unit_price > 0)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  rating integer not null check (rating between 1 and 5),
  body text not null check (length(trim(body)) between 1 and 1500),
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);

create index if not exists products_active_created_idx on public.products(active, created_at desc);
create index if not exists orders_user_created_idx on public.orders(user_id, created_at desc);
create index if not exists reviews_product_approved_idx on public.reviews(product_id, approved, created_at desc);

alter table public.orders add column if not exists stock_restocked boolean not null default false;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.reviews enable row level security;

drop policy if exists "Users read own profile, admins read all" on public.profiles;
create policy "Users read own profile, admins read all" on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_velora_admin()));
drop policy if exists "Admins manage profiles" on public.profiles;
create policy "Admins manage profiles" on public.profiles for update to authenticated
using ((select public.is_velora_admin())) with check ((select public.is_velora_admin()));

drop policy if exists "Anyone reads active products" on public.products;
create policy "Anyone reads active products" on public.products for select to anon, authenticated
using (active or (select public.is_velora_admin()));
drop policy if exists "Admins manage products" on public.products;
create policy "Admins manage products" on public.products for all to authenticated
using ((select public.is_velora_admin())) with check ((select public.is_velora_admin()));

drop policy if exists "Customers read own orders, admins read all" on public.orders;
create policy "Customers read own orders, admins read all" on public.orders for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_velora_admin()));
drop policy if exists "Admins update orders" on public.orders;
create policy "Admins update orders" on public.orders for update to authenticated
using ((select public.is_velora_admin())) with check ((select public.is_velora_admin()));

create or replace function public.restock_cancelled_order()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.status = 'iptal' and new.status <> 'iptal' then
    raise exception 'İptal edilmiş sipariş yeniden açılamaz.';
  end if;
  if new.status = 'iptal' and old.status <> 'iptal' and not old.stock_restocked then
    update public.products p
    set stock = p.stock + i.quantity
    from public.order_items i
    where i.order_id = new.id and i.product_id = p.id;
    new.stock_restocked := true;
  end if;
  return new;
end;
$$;

drop trigger if exists restock_cancelled_order_trigger on public.orders;
create trigger restock_cancelled_order_trigger
before update of status on public.orders
for each row execute function public.restock_cancelled_order();

drop policy if exists "Customers and admins read order items" on public.order_items;
create policy "Customers and admins read order items" on public.order_items for select to authenticated
using (
  exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
  or (select public.is_velora_admin())
);
drop policy if exists "Admins manage order items" on public.order_items;
create policy "Admins manage order items" on public.order_items for all to authenticated
using ((select public.is_velora_admin())) with check ((select public.is_velora_admin()));

drop policy if exists "Anyone reads approved reviews" on public.reviews;
create policy "Anyone reads approved reviews" on public.reviews for select to anon, authenticated
using (approved or user_id = (select auth.uid()) or (select public.is_velora_admin()));
drop policy if exists "Customers add own reviews" on public.reviews;
create policy "Customers add own reviews" on public.reviews for insert to authenticated
with check (user_id = (select auth.uid()) and approved = false);
drop policy if exists "Admins manage reviews" on public.reviews;
create policy "Admins manage reviews" on public.reviews for all to authenticated
using ((select public.is_velora_admin())) with check ((select public.is_velora_admin()));

create or replace function public.place_order(
  p_customer_name text,
  p_phone text,
  p_address text,
  p_items jsonb
)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_id uuid;
  v_email text := auth.jwt() ->> 'email';
begin
  if v_user_id is null then raise exception 'Giriş yapmanız gerekiyor.'; end if;
  if length(trim(p_customer_name)) not between 1 and 120
    or length(trim(p_phone)) not between 3 and 40
    or length(trim(p_address)) not between 1 and 1200 then
    raise exception 'Teslimat bilgileri geçersiz.';
  end if;
  if v_email is null then raise exception 'Hesabınızda doğrulanmış e-posta bulunamadı.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'Sepet boş veya geçersiz.';
  end if;
  perform p.id
  from public.products p
  join (
    select product_id
    from jsonb_to_recordset(p_items) as i(product_id uuid, quantity integer)
    group by product_id
  ) i on i.product_id = p.id
  order by p.id
  for update of p;
  if exists (
    select 1
    from jsonb_to_recordset(p_items) as i(product_id uuid, quantity integer)
    left join public.products p on p.id = i.product_id and p.active
    where p.id is null or i.quantity is null or i.quantity not between 1 and 20
  ) then raise exception 'Sepette satışta olmayan ürün veya geçersiz adet var.'; end if;
  if exists (
    select 1 from (
      select product_id, sum(quantity) as quantity
      from jsonb_to_recordset(p_items) as i(product_id uuid, quantity integer)
      group by product_id
    ) i
    join public.products p on p.id = i.product_id
    where i.quantity > p.stock
  ) then raise exception 'Ürünlerden birinin stoğu yetersiz.'; end if;

  insert into public.orders (user_id, customer_name, email, phone, address, total_amount)
  select v_user_id, trim(p_customer_name), v_email, trim(p_phone), trim(p_address), sum(p.price * i.quantity)
  from jsonb_to_recordset(p_items) as i(product_id uuid, quantity integer)
  join public.products p on p.id = i.product_id and p.active
  group by v_user_id
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, product_name, quantity, unit_price)
  select v_order_id, p.id, p.name, sum(i.quantity)::integer, p.price
  from jsonb_to_recordset(p_items) as i(product_id uuid, quantity integer)
  join public.products p on p.id = i.product_id and p.active
  group by p.id, p.name, p.price;

  update public.products p
  set stock = p.stock - i.quantity
  from (
    select product_id, sum(quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as i(product_id uuid, quantity integer)
    group by product_id
  ) i
  where p.id = i.product_id;

  return v_order_id;
end;
$$;

revoke all on function public.place_order(text, text, text, jsonb) from public, anon;
grant execute on function public.place_order(text, text, text, jsonb) to authenticated;

grant select on public.products to anon, authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select on public.reviews to anon, authenticated;
grant select, insert, update, delete on public.reviews to authenticated;
grant select, update on public.orders to authenticated;
grant select, insert, update, delete on public.order_items to authenticated;
grant select, update on public.profiles to authenticated;

-- Bir kullanıcıyı yönetici yapmak için, Supabase Dashboard'da ilgili auth.users
-- UUID'sini doğruladıktan sonra SQL Editor'da ayrıca çalıştırın:
-- update public.profiles set role = 'admin' where id = 'AUTH_USER_UUID';
