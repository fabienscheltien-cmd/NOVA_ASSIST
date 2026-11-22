-- Nova Assist : proposition de schéma (référence pour Lovable, PAS une migration appliquée).
-- Même nommage de rôles que Nova Pass pour faciliter un rapprochement futur.

create type public.app_role as enum ('super_admin', 'hotesse');

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  ville text,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  primary key (user_id, role)
);

-- Un compte d'accueil est rattaché à un site (1 site = 1 e-mail d'accueil).
create table public.site_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade
);

create table public.livrets (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  titre text not null,
  format text not null check (format in ('docx', 'pdf', 'pptx')),
  fichier_nom text not null,
  fichier_path text not null,            -- bucket privé « livrets » : {site_id}/{livret_id}/{fichier}
  statut text not null default 'en_analyse' check (statut in ('en_analyse', 'publie', 'erreur')),
  nb_pages int,
  avertissement text,                    -- ex. PDF scanné sans texte
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.livret_pages (
  id uuid primary key default gen_random_uuid(),
  livret_id uuid not null references public.livrets(id) on delete cascade,
  numero int not null,
  titre text,
  contenu jsonb not null default '[]',   -- blocs : h, p, ul, steps, table, image, tip
  texte_brut text not null default '',   -- sert au chat et au contrôle de fidélité
  unique (livret_id, numero)
);

create table public.questions_sans_reponse (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  question text not null,
  posee_par uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  statut text not null default 'ouverte' check (statut in ('ouverte', 'traitee')),
  reponse text,
  traitee_par uuid references auth.users(id) on delete set null,
  traitee_at timestamptz
);

create table public.complements (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  question text not null,
  reponse text not null,
  question_id uuid references public.questions_sans_reponse(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Fonctions d'accès (security definer, pour éviter la récursion RLS)
create function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create function public.can_read_site(_user_id uuid, _site_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id, 'super_admin')
      or exists (select 1 from public.site_members where user_id = _user_id and site_id = _site_id)
$$;

alter table public.sites enable row level security;
alter table public.user_roles enable row level security;
alter table public.site_members enable row level security;
alter table public.livrets enable row level security;
alter table public.livret_pages enable row level security;
alter table public.questions_sans_reponse enable row level security;
alter table public.complements enable row level security;

-- Lecture : le Super Admin voit tout, un compte d'accueil voit uniquement son site.
create policy sites_select on public.sites for select to authenticated using (public.can_read_site(auth.uid(), id));
create policy livrets_select on public.livrets for select to authenticated using (public.can_read_site(auth.uid(), site_id));
create policy pages_select on public.livret_pages for select to authenticated
  using (exists (select 1 from public.livrets l where l.id = livret_id and public.can_read_site(auth.uid(), l.site_id)));
create policy complements_select on public.complements for select to authenticated using (public.can_read_site(auth.uid(), site_id));

-- Écriture réservée au Super Admin.
create policy sites_admin on public.sites for all to authenticated using (public.has_role(auth.uid(), 'super_admin')) with check (public.has_role(auth.uid(), 'super_admin'));
create policy livrets_admin on public.livrets for all to authenticated using (public.has_role(auth.uid(), 'super_admin')) with check (public.has_role(auth.uid(), 'super_admin'));
create policy pages_admin on public.livret_pages for all to authenticated using (public.has_role(auth.uid(), 'super_admin')) with check (public.has_role(auth.uid(), 'super_admin'));
create policy complements_admin on public.complements for all to authenticated using (public.has_role(auth.uid(), 'super_admin')) with check (public.has_role(auth.uid(), 'super_admin'));
create policy roles_admin on public.user_roles for all to authenticated using (public.has_role(auth.uid(), 'super_admin')) with check (public.has_role(auth.uid(), 'super_admin'));
create policy members_admin on public.site_members for all to authenticated using (public.has_role(auth.uid(), 'super_admin')) with check (public.has_role(auth.uid(), 'super_admin'));
create policy members_self on public.site_members for select to authenticated using (user_id = auth.uid());
create policy roles_self on public.user_roles for select to authenticated using (user_id = auth.uid());

-- Questions sans réponse : l'accueil du site peut en créer (via la fonction serveur du chat) ;
-- seul le Super Admin les lit et les traite.
create policy qsr_admin on public.questions_sans_reponse for all to authenticated using (public.has_role(auth.uid(), 'super_admin')) with check (public.has_role(auth.uid(), 'super_admin'));
create policy qsr_insert_site on public.questions_sans_reponse for insert to authenticated with check (public.can_read_site(auth.uid(), site_id));

-- Stockage : bucket privé « livrets », lecture limitée au site du chemin ({site_id}/...), écriture Super Admin.
