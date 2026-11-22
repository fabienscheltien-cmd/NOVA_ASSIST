import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SourceReponse } from "./ia/prompts.ts";

/** Profil du compte connecté : rôle et site rattaché. */
export const monProfil = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { estSuperAdmin } = await import("./acces.server.ts");
    const admin = await estSuperAdmin(context.supabase, context.userId);
    const { data: membre } = await context.supabase
      .from("site_members")
      .select("site_id, sites(nom)")
      .eq("user_id", context.userId)
      .maybeSingle();
    const site = (membre?.sites as unknown as { nom: string } | null) ?? null;
    return {
      userId: context.userId,
      email: (context.claims as { email?: string }).email ?? "",
      estSuperAdmin: admin,
      siteId: membre?.site_id ?? null,
      siteNom: site?.nom ?? null,
    };
  });

/** Sites lisibles par le compte (tous pour le Super Admin). */
export const listerSites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sites")
      .select("id, nom, ville")
      .order("nom");
    if (error) throw new Error("Lecture des sites impossible.");
    return data ?? [];
  });

export type ReponseChat =
  | {
      ok: true;
      trouve: boolean;
      reponse: string;
      sources: SourceReponse[];
    }
  | { ok: false; erreur: string };

/**
 * Serenity : répond uniquement d'après les livrets publiés et les compléments du site.
 * Si l'information n'y est pas, renvoie « Je ne sais pas, désolé. » et enregistre la question.
 */
export const poserQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        siteId: z.string().uuid(),
        question: z.string().trim().min(2).max(800),
        historique: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
          .max(8)
          .default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<ReponseChat> => {
    const acces = await import("./acces.server.ts");
    const ia = await import("./ia.server.ts");
    const p = await import("./ia/prompts.ts");
    const r = await import("./ia/recherche.ts");
    try {
      // Contrôle d'accès avant tout appel à l'IA (RLS : le site doit être lisible par ce compte).
      const site = await acces.exigerSite(context.supabase, data.siteId);
      const livrets = await acces.chargerLivrets(context.supabase, site.id);
      const complements = await acces.chargerComplements(context.supabase, site.id);
      const enregistrer = () =>
        context.supabase
          .from("questions_sans_reponse")
          .insert({ site_id: site.id, question: data.question, posee_par: context.userId });

      if (livrets.length === 0 && complements.length === 0) {
        await enregistrer();
        return { ok: true, trouve: false, reponse: p.REPONSE_INCONNUE, sources: [] };
      }

      // Seules les pages utiles à la question partent à l'IA (moins de tokens : plus de questions gratuites).
      const { texte, reperes } = p.construireContexte(
        r.selectionnerPages(livrets, data.question),
        complements,
      );
      const brut = await ia.demanderIA({
        system: p.consigneSerenity(site.nom, texte),
        messages: [...data.historique, { role: "user", content: data.question }],
        effort: "low",
        modele: ia.MODELE_SERENITY,
      });
      const resultat = p.lireReponseSerenity(brut, reperes);
      if (!resultat.trouve) await enregistrer();
      return { ok: true, ...resultat };
    } catch (e) {
      return { ok: false, erreur: acces.messageErreur(e, "Serenity n'a pas pu répondre.") };
    }
  });
