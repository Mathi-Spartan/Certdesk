-- CertDesk Assist: support conversations, messages and the knowledge base.
-- Additive only: creates new tables and indexes, changes nothing that exists.

create table if not exists console.assist_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references console.workspaces(id) on delete cascade,
  user_id uuid references console.users(id) on delete set null,
  status text not null default 'bot',            -- bot | waiting | human | resolved
  assigned_to uuid references console.users(id) on delete set null,
  subject text,
  context jsonb not null default '{}'::jsonb,     -- current order, last intent
  unread_admin int not null default 0,
  unread_customer int not null default 0,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists assist_conv_ws on console.assist_conversations (workspace_id, last_message_at desc);
create index if not exists assist_conv_status on console.assist_conversations (status, last_message_at desc);

create table if not exists console.assist_messages (
  id bigserial primary key,
  conversation_id uuid not null references console.assist_conversations(id) on delete cascade,
  role text not null,                              -- user | bot | agent | system
  body text not null default '',
  data jsonb not null default '{}'::jsonb,         -- buttons, cards, order id, scores
  intent text,
  matched boolean,
  helpful boolean,
  author_id uuid references console.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists assist_msg_conv on console.assist_messages (conversation_id, id);
create index if not exists assist_msg_unmatched on console.assist_messages (created_at desc) where matched = false;

create table if not exists console.assist_articles (
  id serial primary key,
  slug text unique not null,
  title text not null,
  category text not null default 'General',
  keywords text[] not null default '{}',
  body text not null,
  published boolean not null default true,
  views int not null default 0,
  helpful int not null default 0,
  unhelpful int not null default 0,
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', array_to_string(keywords, ' ')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'C')
  ) stored
);
create index if not exists assist_articles_search on console.assist_articles using gin (search);
