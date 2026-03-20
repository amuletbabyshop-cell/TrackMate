-- supabase/schema.sql
-- TrackMate データベーススキーマ
-- Supabase の SQL Editor にそのまま貼り付けて実行

-- ─────────────────────────────────────────
-- 拡張機能
-- ─────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- ユーザープロフィール
-- ─────────────────────────────────────────
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique references auth.users(id) on delete cascade,
  name text not null,
  primary_event text not null default '100m',
  secondary_events text[] default '{}',
  event_category text not null default 'sprint'
    check (event_category in ('sprint', 'middle', 'long')),
  personal_best_ms integer,
  target_time_ms integer,
  age integer,
  experience_years integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- トレーニング記録
-- ─────────────────────────────────────────
create table if not exists training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  session_date date not null,
  session_type text not null
    check (session_type in ('interval','tempo','easy','long','sprint','drill','strength','race','rest')),
  event text,
  time_ms integer,
  distance_m integer,
  reps integer,
  sets integer,
  rest_sec integer,
  fatigue_level integer not null default 5
    check (fatigue_level between 1 and 10),
  condition_level integer not null default 5
    check (condition_level between 1 and 10),
  weather text,
  temperature integer,
  notes text,
  video_url text,
  ai_feedback text,
  created_at timestamptz default now()
);

create index if not exists idx_sessions_user_date
  on training_sessions(user_id, session_date desc);

-- ─────────────────────────────────────────
-- 食事記録
-- ─────────────────────────────────────────
create table if not exists meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  meal_date date not null,
  meal_type text not null default 'lunch'
    check (meal_type in ('breakfast','lunch','dinner','snack','supplement')),
  photo_url text,
  foods jsonb not null default '[]',
  total_calories integer not null default 0,
  total_protein numeric(6,1) not null default 0,
  total_carb numeric(6,1) not null default 0,
  total_fat numeric(6,1) not null default 0,
  training_timing text default 'none'
    check (training_timing in ('pre','post','none')),
  advice text,
  created_at timestamptz default now()
);

create index if not exists idx_meals_user_date
  on meals(user_id, meal_date desc);

-- ─────────────────────────────────────────
-- 試合計画
-- ─────────────────────────────────────────
create table if not exists competition_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  competition_name text not null,
  competition_date date not null,
  event text not null,
  target_time_ms integer,
  days_until integer,
  plan_json jsonb not null default '{}',
  peak_week integer,
  taper_start_week integer,
  key_advice text,
  created_at timestamptz default now()
);

create index if not exists idx_competitions_user_date
  on competition_plans(user_id, competition_date asc);

-- ─────────────────────────────────────────
-- 睡眠記録
-- ─────────────────────────────────────────
create table if not exists sleep_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  sleep_date date not null,
  sleep_start timestamptz,
  sleep_end timestamptz,
  duration_min integer
    generated always as (
      extract(epoch from (sleep_end - sleep_start))::integer / 60
    ) stored,
  quality_score integer not null default 5
    check (quality_score between 1 and 10),
  deep_sleep_min integer,
  rhr integer,      -- resting heart rate
  hrv integer,      -- heart rate variability
  notes text,
  created_at timestamptz default now(),
  unique (user_id, sleep_date)
);

create index if not exists idx_sleep_user_date
  on sleep_records(user_id, sleep_date desc);

-- ─────────────────────────────────────────
-- Row Level Security（RLS）
-- ─────────────────────────────────────────
alter table users enable row level security;
alter table training_sessions enable row level security;
alter table meals enable row level security;
alter table competition_plans enable row level security;
alter table sleep_records enable row level security;

-- 自分のデータだけ読み書きできる
create policy "users_own_data" on users
  for all using (auth_id = auth.uid());

create policy "sessions_own_data" on training_sessions
  for all using (user_id = (select id from users where auth_id = auth.uid()));

create policy "meals_own_data" on meals
  for all using (user_id = (select id from users where auth_id = auth.uid()));

create policy "competitions_own_data" on competition_plans
  for all using (user_id = (select id from users where auth_id = auth.uid()));

create policy "sleep_own_data" on sleep_records
  for all using (user_id = (select id from users where auth_id = auth.uid()));

-- ─────────────────────────────────────────
-- Storage バケット（Supabase Dashboard で作成するか、ここで）
-- ─────────────────────────────────────────
-- insert into storage.buckets (id, name, public) values ('videos', 'videos', false);
-- insert into storage.buckets (id, name, public) values ('meal-photos', 'meal-photos', false);
