create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  display_name text,
  plan text not null default 'free',
  credits_balance integer,
  created_at timestamptz not null default now()
);

create table public.hook_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table public.hooks (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.hook_categories(id) on delete cascade,
  template text not null,
  notes text,
  source text not null default 'system',
  owner_id uuid,
  is_favorite boolean not null default false,
  is_active boolean not null default true,
  usage_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  name text,
  link text,
  description text,
  image_urls text[] not null default '{}',
  page_extract text,
  analysis jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.influencers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  name text not null,
  gender text,
  age_range text,
  style text,
  niche text,
  appearance jsonb not null default '{}',
  identity text,
  description text,
  visual_traits text,
  reference_image_urls text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  product_id uuid references public.products(id) on delete set null,
  influencer_id uuid references public.influencers(id) on delete set null,
  parent_project_id uuid references public.projects(id) on delete set null,
  title text not null default 'Novo criativo',
  status text not null default 'draft',
  current_step text not null default 'analysis',
  auto_mode boolean not null default false,
  settings jsonb not null default '{}',
  strategy jsonb,
  hook jsonb,
  script jsonb,
  scenes jsonb not null default '[]',
  caption text,
  cta text,
  hashtags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.generated_images (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  project_id uuid references public.projects(id) on delete cascade,
  influencer_id uuid references public.influencers(id) on delete cascade,
  kind text not null,
  prompt text,
  url text not null,
  created_at timestamptz not null default now()
);

create table public.generations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  project_id uuid,
  task text not null,
  model text,
  status text not null,
  error text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

grant all on public.profiles to service_role;
grant all on public.hook_categories to service_role;
grant all on public.hooks to service_role;
grant all on public.products to service_role;
grant all on public.influencers to service_role;
grant all on public.projects to service_role;
grant all on public.generated_images to service_role;
grant all on public.generations to service_role;
grant all on public.app_settings to service_role;

alter table public.profiles enable row level security;
alter table public.hook_categories enable row level security;
alter table public.hooks enable row level security;
alter table public.products enable row level security;
alter table public.influencers enable row level security;
alter table public.projects enable row level security;
alter table public.generated_images enable row level security;
alter table public.generations enable row level security;
alter table public.app_settings enable row level security;

insert into public.app_settings (key, value) values
 ('video_defaults', '{"aspect":"9:16","maxPromptChars":900,"durations":[8,10,15,20,30],"sceneCounts":[1,2,3,4,5,6]}'),
 ('ai', '{"textModel":"google/gemini-3.8-flash","imageModel":"google/gemini-3.1-flash-image","fallback":null}');

insert into public.hook_categories (slug, name, sort_order) values
('curiosidade','Curiosidade',1),('problema-solucao','Problema → solução',2),('polemica','Polêmica',3),('urgencia','Urgência',4),
('economia','Economia',5),('demonstracao','Demonstração',6),('pov','POV',7),('humor','Humor',8),('antes-depois','Antes/depois',9),
('oferta','Oferta',10),('prova-social','Prova social',11),('comparacao','Comparação',12),('teste','Teste',13),('reacao','Reação',14),
('descoberta','Descoberta',15),('erro-comum','Erro comum',16);

insert into public.hooks (category_id, template)
select c.id, h.t from (values
('curiosidade','Eu não sabia disso até testar [produto]...'),('curiosidade','Ninguém me contou que [produto] fazia isso'),('curiosidade','Você já viu isso aqui?'),
('problema-solucao','Se você tem esse problema, olha isso'),('problema-solucao','Cansei de [problema] até achar isso'),('problema-solucao','A solução pra [problema] cabe na sua mão'),
('polemica','Vou falar o que ninguém fala sobre [categoria]'),('polemica','Talvez você discorde, mas...'),
('urgencia','Corre que isso não vai durar'),('urgencia','Se você está vendo isso, ainda dá tempo'),
('economia','Pare de gastar com [alternativa cara]'),('economia','Isso aqui me fez economizar'),
('demonstracao','Olha como funciona na prática'),('demonstracao','Deixa eu te mostrar em 10 segundos'),
('pov','POV: você finalmente achou [produto]'),('pov','POV: sua rotina depois de [produto]'),
('humor','Minha reação quando descobri isso'),('humor','Eu tentando viver sem [produto]:'),
('antes-depois','Antes e depois de usar [produto]'),('antes-depois','Olha a diferença'),
('oferta','Achei no TikTok Shop e olha o preço'),('oferta','Esse preço tá certo?'),
('prova-social','Todo mundo está comprando isso, e eu entendi por quê'),('prova-social','Comprei porque vi em todo lugar'),
('comparacao','Esse ou aquele? Testei os dois'),('comparacao','Parece igual, mas não é'),
('teste','Testei [produto] pra ver se funciona mesmo'),('teste','Será que funciona? Vamos ver'),
('reacao','Abrindo pela primeira vez'),('reacao','Não esperava isso'),
('descoberta','Olha o que eu descobri'),('descoberta','Achado do dia no TikTok Shop'),
('erro-comum','Pare de fazer isso'),('erro-comum','Você está usando errado')
) as h(slug,t) join public.hook_categories c on c.slug = h.slug;