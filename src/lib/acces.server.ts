/** Aides serveur partagées : contrôle des droits et chargement des livrets d'un site. */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ComplementContexte, LivretContexte } from "./ia/prompts.ts";

export type Client = SupabaseClient<Database>;

export async function estSuperAdmin(supabase: Client, userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
  return data === true;
}

export async function exigerSuperAdmin(supabase: Client, userId: string): Promise<void> {
  if (!(await estSuperAdmin(supabase, userId))) throw new Error("Réservé au Super Admin.");
}

/** Vérifie que le compte connecté peut lire ce site (RLS) et renvoie son nom. */
export async function exigerSite(
  supabase: Client,
  siteId: string,
): Promise<{ id: string; nom: string }> {
  const { data } = await supabase.from("sites").select("id, nom").eq("id", siteId).maybeSingle();
  if (!data) throw new Error("Site inaccessible.");
  return data;
}

/** Livrets publiés d'un site (ou un seul livret) avec le texte de leurs pages, lus avec les droits du compte. */
export async function chargerLivrets(
  supabase: Client,
  siteId: string,
  livretId?: string,
): Promise<LivretContexte[]> {
  let req = supabase
    .from("livrets")
    .select("id, titre")
    .eq("site_id", siteId)
    .eq("statut", "publie")
    .order("created_at");
  if (livretId) req = req.eq("id", livretId);
  const { data: livrets, error } = await req;
  if (error) throw new Error("Lecture des livrets impossible.");
  if (!livrets || livrets.length === 0) return [];
  const { data: pages, error: e2 } = await supabase
    .from("livret_pages")
    .select("livret_id, numero, titre, texte_brut")
    .in(
      "livret_id",
      livrets.map((l) => l.id),
    )
    .order("numero");
  if (e2) throw new Error("Lecture des pages impossible.");
  return livrets.map((l) => ({
    id: l.id,
    titre: l.titre,
    pages: (pages ?? [])
      .filter((p) => p.livret_id === l.id)
      .map((p) => ({ numero: p.numero, titre: p.titre, texte: p.texte_brut })),
  }));
}

export async function chargerComplements(
  supabase: Client,
  siteId: string,
): Promise<ComplementContexte[]> {
  const { data } = await supabase
    .from("complements")
    .select("id, question, reponse")
    .eq("site_id", siteId)
    .order("created_at");
  return data ?? [];
}

export function messageErreur(e: unknown, defaut: string): string {
  return e instanceof Error && e.message ? e.message : defaut;
}
