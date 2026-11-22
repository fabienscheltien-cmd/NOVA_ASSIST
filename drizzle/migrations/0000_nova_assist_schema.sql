-- Nova Assist : schéma initial (sites, comptes, livrets, pages, questions, compléments,
-- alertes d'incohérences et fiches réflexes générées par l'IA).
-- Rôles et noms de tables alignés sur Nova Pass pour un rapprochement futur.

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
  avertissement text,                    -- ex. PDF scanné sans texte, écart de fidélité
  controle jsonb,                        -- résultat du contrôle de fidélité { couverture, manquants }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index livrets_site_idx on public.livrets (site_id);

create table public.livret_pages (
  id uuid primary key default gen_random_uuid(),
  livret_id uuid not null references public.livrets(id) on delete cascade,
  numero int not null,
  titre text,
  contenu jsonb not null default '[]',   -- blocs : h, p, ul, ol, steps, table, image, tip
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
create index qsr_site_idx on public.questions_sans_reponse (site_id, statut);

create table public.complements (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  question text not null,
  reponse text not null,
  question_id uuid references public.questions_sans_reponse(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Alertes d'incohérences détectées par l'IA entre les livrets d'un site (Super Admin uniquement).
create table public.alertes_incoherences (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  type text not null check (type in ('contradiction', 'a_completer', 'autre')),
  titre text not null,
  description text not null,
  sources jsonb not null default '[]',   -- [{ livret_id, livret_titre, page, extrait }]
  statut text not null default 'ouverte' check (statut in ('ouverte', 'resolue', 'ignoree')),
  created_at timestamptz not null default now(),
  traitee_at timestamptz
);
create index alertes_site_idx on public.alertes_incoherences (site_id, statut);

-- Fiches réflexes résumées par l'IA, visibles par l'accueil seulement une fois validées.
create table public.fiches_reflexes (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  livret_id uuid not null references public.livrets(id) on delete cascade,
  ordre int not null default 0,
  titre text not null,
  quand text,                            -- situation déclenchante (« Un livreur se présente… »)
  etapes jsonb not null default '[]',    -- liste de chaînes, dans l'ordre
  page int,                              -- page source dans le livret
  statut text not null default 'brouillon' check (statut in ('brouillon', 'validee')),
  created_at timestamptz not null default now(),
  validee_at timestamptz
);
create index fiches_livret_idx on public.fiches_reflexes (livret_id);

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
alter table public.alertes_incoherences enable row level security;
alter table public.fiches_reflexes enable row level security;

-- Lecture : le Super Admin voit tout, un compte d'accueil voit uniquement son site.
create policy sites_select on public.sites for select to authenticated using (public.can_read_site(auth.uid(), id));
create policy livrets_select on public.livrets for select to authenticated
  using (public.can_read_site(auth.uid(), site_id) and (statut = 'publie' or public.has_role(auth.uid(), 'super_admin')));
create policy pages_select on public.livret_pages for select to authenticated
  using (exists (
    select 1 from public.livrets l
    where l.id = livret_id and public.can_read_site(auth.uid(), l.site_id)
      and (l.statut = 'publie' or public.has_role(auth.uid(), 'super_admin'))
  ));
create policy complements_select on public.complements for select to authenticated using (public.can_read_site(auth.uid(), site_id));
create policy fiches_select on public.fiches_reflexes for select to authenticated
  using (public.can_read_site(auth.uid(), site_id) and (statut = 'validee' or public.has_role(auth.uid(), 'super_admin')));

-- Écriture réservée au Super Admin.
create policy sites_admin on public.sites for all to authenticated using (public.has_role(auth.uid(), 'super_admin')) with check (public.has_role(auth.uid(), 'super_admin'));
create policy livrets_admin on public.livrets for all to authenticated using (public.has_role(auth.uid(), 'super_admin')) with check (public.has_role(auth.uid(), 'super_admin'));
create policy pages_admin on public.livret_pages for all to authenticated using (public.has_role(auth.uid(), 'super_admin')) with check (public.has_role(auth.uid(), 'super_admin'));
create policy complements_admin on public.complements for all to authenticated using (public.has_role(auth.uid(), 'super_admin')) with check (public.has_role(auth.uid(), 'super_admin'));
create policy alertes_admin on public.alertes_incoherences for all to authenticated using (public.has_role(auth.uid(), 'super_admin')) with check (public.has_role(auth.uid(), 'super_admin'));
create policy fiches_admin on public.fiches_reflexes for all to authenticated using (public.has_role(auth.uid(), 'super_admin')) with check (public.has_role(auth.uid(), 'super_admin'));
create policy roles_admin on public.user_roles for all to authenticated using (public.has_role(auth.uid(), 'super_admin')) with check (public.has_role(auth.uid(), 'super_admin'));
create policy members_admin on public.site_members for all to authenticated using (public.has_role(auth.uid(), 'super_admin')) with check (public.has_role(auth.uid(), 'super_admin'));
create policy members_self on public.site_members for select to authenticated using (user_id = auth.uid());
create policy roles_self on public.user_roles for select to authenticated using (user_id = auth.uid());

-- Questions sans réponse : l'accueil du site peut en créer (via la fonction serveur du chat) ;
-- seul le Super Admin les lit et les traite.
create policy qsr_admin on public.questions_sans_reponse for all to authenticated using (public.has_role(auth.uid(), 'super_admin')) with check (public.has_role(auth.uid(), 'super_admin'));
create policy qsr_insert_site on public.questions_sans_reponse for insert to authenticated
  with check (public.can_read_site(auth.uid(), site_id) and posee_par = auth.uid());

-- Stockage : bucket privé « livrets » ({site_id}/{livret_id}/...), lecture limitée au site, écriture Super Admin.

create policy livrets_storage_select on storage.objects for select to authenticated
  using (
    bucket_id = 'livrets'
    and public.can_read_site(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
create policy livrets_storage_admin on storage.objects for all to authenticated
  using (bucket_id = 'livrets' and public.has_role(auth.uid(), 'super_admin'))
  with check (bucket_id = 'livrets' and public.has_role(auth.uid(), 'super_admin'));

-- Droits explicites (Lovable Cloud) : la RLS ci-dessus décide ensuite ligne par ligne.
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on
  public.sites, public.user_roles, public.site_members, public.livrets, public.livret_pages,
  public.questions_sans_reponse, public.complements, public.alertes_incoherences, public.fiches_reflexes
  to authenticated;
grant all on
  public.sites, public.user_roles, public.site_members, public.livrets, public.livret_pages,
  public.questions_sans_reponse, public.complements, public.alertes_incoherences, public.fiches_reflexes
  to service_role;
revoke all on function public.has_role(uuid, public.app_role) from public;
revoke all on function public.can_read_site(uuid, uuid) from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.can_read_site(uuid, uuid) to authenticated, service_role;

-- Super Admins NOVA : le rôle est attribué automatiquement aux deux adresses ci-dessous
-- dès que leur compte existe et que l'e-mail est confirmé.
create function public.attribuer_super_admin_nova()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(new.email) in ('aurelie.godin@nova-serenity.fr', 'fabien.scheltien@nova-serenity.fr')
     and new.email_confirmed_at is not null then
    insert into public.user_roles (user_id, role) values (new.id, 'super_admin')
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end $$;
revoke all on function public.attribuer_super_admin_nova() from public;
create trigger nova_super_admin_confirme
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.attribuer_super_admin_nova();
