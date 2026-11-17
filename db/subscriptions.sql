-- Automated SSL subscriptions (GoGetSSL API v2: Plan + Automate and ACME CaaS)
create table if not exists console.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references console.workspaces(id) on delete cascade,
  kind text not null check (kind in ('caas','ais')),
  product_id int,
  product_name text,
  gg_order_id bigint,
  item_id bigint unique,
  status text not null default 'pending',
  primary_domain text,
  domains jsonb not null default '[]',
  install_method text,
  auto_renew boolean,
  begin_at timestamptz,
  end_at timestamptz,
  next_renewal_at timestamptz,
  account jsonb,
  autoinstall jsonb,
  contacts jsonb,
  raw jsonb,
  tags text[] not null default '{}',
  created_by uuid references console.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_synced_at timestamptz,
  cancel_requested_at timestamptz
);
create index if not exists subscriptions_ws on console.subscriptions(workspace_id);

create table if not exists console.subscription_events (
  id bigserial primary key,
  subscription_id uuid not null references console.subscriptions(id) on delete cascade,
  kind text not null,
  message text not null,
  endpoint text,
  actor_user_id uuid references console.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists subscription_events_sub on console.subscription_events(subscription_id, created_at desc);

alter table console.api_log add column if not exists api text not null default 'v1';
alter table console.api_log add column if not exists method text;
