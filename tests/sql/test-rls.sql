-- Test d'acceptation : un compte d'accueil du site A ne lit jamais le site B.
grant all on all tables in schema public, storage to authenticated;
insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'admin@nova.fr'),
  ('00000000-0000-0000-0000-00000000000b', 'accueil-seine@nova.fr'),
  ('00000000-0000-0000-0000-00000000000c', 'accueil-elysee@nova.fr');
insert into public.sites (id, nom) values
  ('11111111-1111-1111-1111-111111111111', 'Seine Avenue'),
  ('22222222-2222-2222-2222-222222222222', 'Élysée');
insert into public.user_roles values
  ('00000000-0000-0000-0000-00000000000a', 'super_admin'),
  ('00000000-0000-0000-0000-00000000000b', 'hotesse'),
  ('00000000-0000-0000-0000-00000000000c', 'hotesse');
insert into public.site_members values
  ('00000000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111'),
  ('00000000-0000-0000-0000-00000000000c', '22222222-2222-2222-2222-222222222222');
insert into public.livrets (id, site_id, titre, format, fichier_nom, fichier_path, statut) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Accueil', 'pptx', 'a.pptx', 'x', 'publie'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Accueil', 'pptx', 'b.pptx', 'x', 'publie'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Brouillon', 'pdf', 'c.pdf', 'x', 'en_analyse');
insert into public.livret_pages (livret_id, numero, texte_brut) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 1, 'seine'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 1, 'elysee'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 1, 'brouillon');
insert into public.fiches_reflexes (site_id, livret_id, titre, statut) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'validée', 'validee'),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'brouillon', 'brouillon');
insert into public.alertes_incoherences (site_id, type, titre, description) values
  ('11111111-1111-1111-1111-111111111111', 'contradiction', 'Adresse', '2 rue / 4-8 rue');
insert into storage.objects (bucket_id, name) values
  ('livrets', '11111111-1111-1111-1111-111111111111/aaaaaaaa-0000-0000-0000-000000000001/a.pptx'),
  ('livrets', '22222222-2222-2222-2222-222222222222/aaaaaaaa-0000-0000-0000-000000000002/b.pptx');

create function pg_temp.verifier(cond boolean, msg text) returns void language plpgsql as $$
begin if not cond then raise exception 'ÉCHEC : %', msg; end if; raise notice 'ok : %', msg; end $$;

set role authenticated;
-- Accueil Seine Avenue
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select pg_temp.verifier((select count(*) from public.sites) = 1, 'accueil : un seul site visible');
select pg_temp.verifier((select count(*) from public.livrets) = 1, 'accueil : seulement le livret publié de son site');
select pg_temp.verifier((select count(*) from public.livret_pages where texte_brut = 'elysee') = 0, 'accueil : pages du site B invisibles');
select pg_temp.verifier((select count(*) from public.livret_pages) = 1, 'accueil : pages d''un livret non publié invisibles');
select pg_temp.verifier((select count(*) from storage.objects) = 1, 'accueil : fichier du site B invisible');
select pg_temp.verifier((select count(*) from public.fiches_reflexes) = 1, 'accueil : fiche brouillon invisible');
select pg_temp.verifier((select count(*) from public.alertes_incoherences) = 0, 'accueil : alertes invisibles');
insert into public.questions_sans_reponse (site_id, question, posee_par)
  values ('11111111-1111-1111-1111-111111111111', 'Code wifi ?', '00000000-0000-0000-0000-00000000000b');
select pg_temp.verifier((select count(*) from public.questions_sans_reponse) = 0, 'accueil : enregistre une question sans pouvoir la relire');
do $$ begin
  insert into public.questions_sans_reponse (site_id, question, posee_par)
    values ('22222222-2222-2222-2222-222222222222', 'x', '00000000-0000-0000-0000-00000000000b');
  raise exception 'ÉCHEC : question sur le site B acceptée';
exception when insufficient_privilege then raise notice 'ok : question sur le site B refusée';
end $$;
do $$ begin
  insert into public.complements (site_id, question, reponse) values ('11111111-1111-1111-1111-111111111111', 'q', 'r');
  raise exception 'ÉCHEC : accueil écrit un complément';
exception when insufficient_privilege then raise notice 'ok : accueil ne peut pas écrire de complément';
end $$;

-- Super Admin
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select pg_temp.verifier((select count(*) from public.livrets) = 3, 'admin : voit tous les livrets');
select pg_temp.verifier((select count(*) from public.questions_sans_reponse) = 1, 'admin : voit la question');
select pg_temp.verifier((select count(*) from public.alertes_incoherences) = 1, 'admin : voit les alertes');
insert into public.complements (site_id, question, reponse) values ('11111111-1111-1111-1111-111111111111', 'Code wifi ?', 'NOVA2026');
reset role;
insert into auth.users values ('00000000-0000-0000-0000-0000000000dd', 'Aurelie.Godin@nova-serenity.fr', now());
select pg_temp.verifier(public.has_role('00000000-0000-0000-0000-0000000000dd', 'super_admin'), 'super admin attribué automatiquement à Aurélie');
insert into auth.users values ('00000000-0000-0000-0000-0000000000ee', 'inconnu@exemple.fr', now());
select pg_temp.verifier(not public.has_role('00000000-0000-0000-0000-0000000000ee', 'super_admin'), 'aucun rôle pour une autre adresse');
