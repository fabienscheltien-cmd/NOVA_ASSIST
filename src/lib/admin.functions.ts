import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";

const uuid = z.string().uuid();

async function admin(context: { supabase: import("./acces.server.ts").Client; userId: string }) {
  const { exigerSuperAdmin } = await import("./acces.server.ts");
  await exigerSuperAdmin(context.supabase, context.userId);
}

/* ------------------------------ Questions sans réponse ------------------------------ */

export const listerQuestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ siteId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { data: q } = await context.supabase
      .from("questions_sans_reponse")
      .select("id, question, statut, reponse, created_at, traitee_at")
      .eq("site_id", data.siteId)
      .order("created_at", { ascending: false })
      .limit(200);
    return q ?? [];
  });

/** Compteurs des pastilles d'onglets (questions ouvertes, alertes ouvertes, fiches à valider). */
export const compteursAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ siteId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const compter = async (
      table: "questions_sans_reponse" | "alertes_incoherences" | "fiches_reflexes",
      statut: string,
    ) => {
      const { count } = await context.supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("site_id", data.siteId)
        .eq("statut", statut);
      return count ?? 0;
    };
    return {
      questions: await compter("questions_sans_reponse", "ouverte"),
      alertes: await compter("alertes_incoherences", "ouverte"),
      fiches: await compter("fiches_reflexes", "brouillon"),
    };
  });

/** La réponse du Super Admin devient un complément consulté par Serenity. */
export const repondreQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ questionId: uuid, reponse: z.string().trim().min(1).max(4000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await admin(context);
    const { data: q } = await context.supabase
      .from("questions_sans_reponse")
      .select("id, site_id, question")
      .eq("id", data.questionId)
      .single();
    if (!q) throw new Error("Question introuvable.");
    const { error } = await context.supabase.from("complements").insert({
      site_id: q.site_id,
      question: q.question,
      reponse: data.reponse,
      question_id: q.id,
    });
    if (error) throw new Error("Ajout du complément impossible.");
    await context.supabase
      .from("questions_sans_reponse")
      .update({
        statut: "traitee",
        reponse: data.reponse,
        traitee_par: context.userId,
        traitee_at: new Date().toISOString(),
      })
      .eq("id", q.id);
    return { ok: true };
  });

export const supprimerQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ questionId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    await context.supabase.from("questions_sans_reponse").delete().eq("id", data.questionId);
    return { ok: true };
  });

export const supprimerComplement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ complementId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    await context.supabase.from("complements").delete().eq("id", data.complementId);
    return { ok: true };
  });

/* ------------------------------ Alertes d'incohérences (IA) ------------------------------ */

export const analyserIncoherences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ siteId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const acces = await import("./acces.server.ts");
    const p = await import("./ia/prompts.ts");
    const ia = await import("./ia.server.ts");
    const site = await acces.exigerSite(context.supabase, data.siteId);
    const livrets = await acces.chargerLivrets(context.supabase, site.id);
    if (livrets.length === 0) return { nombre: 0 };
    const { texte, reperes } = p.construireContexte(livrets);
    const reponse = await ia.demanderJson(
      "Tu es un relecteur rigoureux de documents d'entreprise. Réponds uniquement en JSON.",
      p.consigneIncoherences(site.nom, texte),
      "medium",
    );
    const alertes = p.lireIncoherences(reponse, reperes);
    // Les alertes encore ouvertes sont remplacées par la nouvelle analyse ; les alertes traitées restent.
    await context.supabase
      .from("alertes_incoherences")
      .delete()
      .eq("site_id", site.id)
      .eq("statut", "ouverte");
    if (alertes.length > 0) {
      const { error } = await context.supabase.from("alertes_incoherences").insert(
        alertes.map((a) => ({
          site_id: site.id,
          type: a.type,
          titre: a.titre,
          description: a.description,
          sources: a.sources as unknown as Json,
        })),
      );
      if (error) throw new Error("Enregistrement des alertes impossible.");
    }
    return { nombre: alertes.length };
  });

export const listerAlertes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ siteId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { data: a } = await context.supabase
      .from("alertes_incoherences")
      .select("id, type, titre, description, sources, statut, created_at")
      .eq("site_id", data.siteId)
      .order("created_at", { ascending: false })
      .limit(200);
    return (a ?? []).map((x) => ({
      ...x,
      sources: (Array.isArray(x.sources) ? x.sources : []) as {
        livret_id: string;
        livret_titre: string;
        page: number;
        extrait: string;
      }[],
    }));
  });

export const traiterAlerte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ alerteId: uuid, statut: z.enum(["ouverte", "resolue", "ignoree"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await admin(context);
    await context.supabase
      .from("alertes_incoherences")
      .update({
        statut: data.statut,
        traitee_at: data.statut === "ouverte" ? null : new Date().toISOString(),
      })
      .eq("id", data.alerteId);
    return { ok: true };
  });

/* ------------------------------ Fiches réflexes (IA) ------------------------------ */

export const genererFiches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ livretId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const acces = await import("./acces.server.ts");
    const p = await import("./ia/prompts.ts");
    const ia = await import("./ia.server.ts");
    const { data: l } = await context.supabase
      .from("livrets")
      .select("id, site_id, titre")
      .eq("id", data.livretId)
      .single();
    if (!l) throw new Error("Livret introuvable.");
    const [livret] = await acces.chargerLivrets(context.supabase, l.site_id, l.id);
    if (!livret) return { nombre: 0 };
    const { texte } = p.construireContexte([livret]);
    const reponse = await ia.demanderJson(
      "Tu rédiges des fiches réflexes fidèles pour des hôtesses d'accueil. Réponds uniquement en JSON.",
      p.consigneFiches(l.titre, texte),
      "medium",
    );
    const fiches = p.lireFiches(reponse, new Set(livret.pages.map((pg) => pg.numero)));
    // Les brouillons précédents de ce livret sont remplacés ; les fiches validées sont conservées.
    await context.supabase
      .from("fiches_reflexes")
      .delete()
      .eq("livret_id", l.id)
      .eq("statut", "brouillon");
    if (fiches.length > 0) {
      const { error } = await context.supabase.from("fiches_reflexes").insert(
        fiches.map((f, i) => ({
          site_id: l.site_id,
          livret_id: l.id,
          ordre: i,
          titre: f.titre,
          quand: f.quand,
          etapes: f.etapes as unknown as Json,
          page: f.page,
        })),
      );
      if (error) throw new Error("Enregistrement des fiches impossible.");
    }
    return { nombre: fiches.length };
  });

export const modifierFiche = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ficheId: uuid,
        titre: z.string().trim().min(1).max(160),
        quand: z.string().trim().max(300).nullable(),
        etapes: z.array(z.string().trim().min(1).max(400)).min(1).max(12),
        statut: z.enum(["brouillon", "validee"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await admin(context);
    await context.supabase
      .from("fiches_reflexes")
      .update({
        titre: data.titre,
        quand: data.quand || null,
        etapes: data.etapes as unknown as Json,
        statut: data.statut,
        validee_at: data.statut === "validee" ? new Date().toISOString() : null,
      })
      .eq("id", data.ficheId);
    return { ok: true };
  });

export const supprimerFiche = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ficheId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    await context.supabase.from("fiches_reflexes").delete().eq("id", data.ficheId);
    return { ok: true };
  });

/* ------------------------------ Sites et comptes d'accueil ------------------------------ */

export const creerSite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        nom: z.string().trim().min(1).max(120),
        ville: z.string().trim().max(120).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await admin(context);
    const { data: s, error } = await context.supabase
      .from("sites")
      .insert({ nom: data.nom, ville: data.ville || null })
      .select("id")
      .single();
    if (error || !s) throw new Error("Création du site impossible.");
    return s;
  });

export const listerComptes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ siteId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: membres } = await context.supabase
      .from("site_members")
      .select("user_id")
      .eq("site_id", data.siteId);
    const res: { userId: string; email: string }[] = [];
    for (const m of membres ?? []) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(m.user_id);
      res.push({ userId: m.user_id, email: u.user?.email ?? "(compte supprimé)" });
    }
    return res;
  });

/** Crée (ou rattache) le compte d'accueil d'un site : 1 site = 1 e-mail d'accueil. */
export const creerCompteAccueil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        siteId: uuid,
        email: z.string().trim().toLowerCase().email(),
        motDePasse: z.string().min(10).max(72),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await admin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cree, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.motDePasse,
      email_confirm: true,
    });
    if (error || !cree.user) {
      throw new Error(
        error?.message.includes("already")
          ? "Un compte existe déjà avec cet e-mail."
          : "Création du compte impossible.",
      );
    }
    const userId = cree.user.id;
    await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: "hotesse" });
    const { error: e2 } = await supabaseAdmin
      .from("site_members")
      .upsert({ user_id: userId, site_id: data.siteId });
    if (e2) throw new Error("Rattachement au site impossible.");
    return { userId };
  });

export const retirerCompteAccueil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await admin(context);
    if (data.userId === context.userId)
      throw new Error("Vous ne pouvez pas supprimer votre propre compte.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.auth.admin.deleteUser(data.userId);
    return { ok: true };
  });
