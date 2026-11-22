import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Bloc } from "./livret/blocs.ts";
import type { Json } from "@/integrations/supabase/types";

const uuid = z.string().uuid();

/** Livrets d'un site : publiés pour l'accueil, tous pour le Super Admin (RLS). */
export const listerLivrets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ siteId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: livrets, error } = await context.supabase
      .from("livrets")
      .select(
        "id, titre, format, fichier_nom, fichier_path, statut, nb_pages, avertissement, controle, created_at, updated_at",
      )
      .eq("site_id", data.siteId)
      .order("created_at");
    if (error) throw new Error("Lecture des livrets impossible.");
    return livrets ?? [];
  });

/** Pages retranscrites d'un livret (rubrique « Détail »). */
export const lirePages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ livretId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { blocsDepuisJson } = await import("./livret/blocs.ts");
    const { data: pages, error } = await context.supabase
      .from("livret_pages")
      .select("numero, titre, contenu")
      .eq("livret_id", data.livretId)
      .order("numero");
    if (error) throw new Error("Lecture des pages impossible.");
    return (pages ?? []).map((p) => ({
      numero: p.numero,
      titre: p.titre,
      blocs: blocsDepuisJson(p.contenu),
    }));
  });

export const lireComplements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ siteId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: c } = await context.supabase
      .from("complements")
      .select("id, question, reponse, created_at")
      .eq("site_id", data.siteId)
      .order("created_at", { ascending: false });
    return c ?? [];
  });

/** Fiches réflexes : validées pour l'accueil, toutes (brouillons compris) pour le Super Admin. */
export const lireFiches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ siteId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: f } = await context.supabase
      .from("fiches_reflexes")
      .select("id, livret_id, ordre, titre, quand, etapes, page, statut, created_at")
      .eq("site_id", data.siteId)
      .order("livret_id")
      .order("ordre");
    return (f ?? []).map((x) => ({
      ...x,
      etapes: Array.isArray(x.etapes)
        ? (x.etapes as unknown[]).filter((e): e is string => typeof e === "string")
        : [],
    }));
  });

/* ------------------------------ Dépôt (Super Admin) ------------------------------ */

/** Crée la fiche du livret avant l'envoi du fichier ; renvoie le dossier de stockage. */
export const creerLivret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        siteId: uuid,
        titre: z.string().trim().min(1).max(120),
        format: z.enum(["docx", "pdf", "pptx"]),
        fichierNom: z.string().trim().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { exigerSuperAdmin } = await import("./acces.server.ts");
    await exigerSuperAdmin(context.supabase, context.userId);
    const id = crypto.randomUUID();
    const nomPropre = data.fichierNom.replace(/[^\w.-]+/g, "_");
    const dossier = `${data.siteId}/${id}`;
    const { error } = await context.supabase.from("livrets").insert({
      id,
      site_id: data.siteId,
      titre: data.titre,
      format: data.format,
      fichier_nom: data.fichierNom,
      fichier_path: `${dossier}/${nomPropre}`,
      statut: "en_analyse",
    });
    if (error) throw new Error("Création du livret impossible.");
    return { id, dossier, fichierPath: `${dossier}/${nomPropre}` };
  });

const schemaPage = z.object({
  numero: z.number().int().min(1),
  titre: z.string().max(300).nullable(),
  blocs: z.array(z.unknown()),
});

/**
 * Étapes « Structuration par l'IA », « Contrôle de fidélité » et « Publication ».
 * L'IA ne propose que des titres et des types de blocs : le texte extrait n'est jamais réécrit.
 */
export const publierLivret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        livretId: uuid,
        pages: z.array(schemaPage).min(1).max(400),
        avertissement: z.string().max(1000).nullable(),
        remplace: uuid.nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const acces = await import("./acces.server.ts");
    const b = await import("./livret/blocs.ts");
    const p = await import("./ia/prompts.ts");
    const ia = await import("./ia.server.ts");
    await acces.exigerSuperAdmin(context.supabase, context.userId);

    const { data: livret } = await context.supabase
      .from("livrets")
      .select("id, site_id, titre")
      .eq("id", data.livretId)
      .single();
    if (!livret) throw new Error("Livret introuvable.");

    const extraites = data.pages.map((pg) => ({
      numero: pg.numero,
      titre: pg.titre,
      blocs: b.blocsDepuisJson(pg.blocs),
    }));

    // Structuration par l'IA (titres de pages et types de blocs) ; en cas d'échec, on garde l'extraction.
    let structurees = extraites;
    let noteIa: string | null = null;
    try {
      const reponse = await ia.demanderJson(
        "Tu es un assistant de mise en forme de documents. Réponds uniquement en JSON.",
        p.consigneStructuration(livret.titre, extraites),
        "low",
      );
      structurees = p.appliquerStructuration(extraites, reponse);
    } catch (e) {
      noteIa = `Structuration par l'IA indisponible (${acces.messageErreur(e, "erreur")}) : titres repris du fichier.`;
    }

    // Contrôle de fidélité : tout le texte extrait doit se retrouver dans la retranscription.
    const source = extraites.map((pg) => b.texteBrut(pg.blocs)).join("\n");
    const final = structurees.map((pg) => b.texteBrut(pg.blocs)).join("\n");
    const controle = b.controleFidelite(source, final);

    const lignes = structurees.map((pg) => ({
      livret_id: livret.id,
      numero: pg.numero,
      titre: pg.titre,
      contenu: pg.blocs as unknown as Json,
      texte_brut: b.texteBrut(pg.blocs as Bloc[]),
    }));
    await context.supabase.from("livret_pages").delete().eq("livret_id", livret.id);
    for (let i = 0; i < lignes.length; i += 50) {
      const { error } = await context.supabase.from("livret_pages").insert(lignes.slice(i, i + 50));
      if (error) throw new Error("Enregistrement des pages impossible.");
    }

    const avertissements = [
      data.avertissement,
      noteIa,
      controle.ok
        ? null
        : `Contrôle de fidélité : ${controle.manquants.length} passage(s) à vérifier.`,
    ].filter(Boolean);
    const { error } = await context.supabase
      .from("livrets")
      .update({
        statut: "publie",
        nb_pages: lignes.length,
        avertissement: avertissements.join(" ") || null,
        controle: {
          couverture: controle.couverture,
          manquants: controle.manquants,
        } as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", livret.id);
    if (error) throw new Error("Publication impossible.");

    // Remplacement : l'ancien livret (pages, fichiers, fiches) disparaît une fois le nouveau publié.
    if (data.remplace && data.remplace !== livret.id) {
      await supprimer(context.supabase, data.remplace);
    }
    return { controle, avertissement: avertissements.join(" ") || null };
  });

export const marquerErreurLivret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ livretId: uuid, message: z.string().max(1000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { exigerSuperAdmin } = await import("./acces.server.ts");
    await exigerSuperAdmin(context.supabase, context.userId);
    await context.supabase
      .from("livrets")
      .update({
        statut: "erreur",
        avertissement: data.message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.livretId);
    return { ok: true };
  });

export const supprimerLivret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ livretId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { exigerSuperAdmin } = await import("./acces.server.ts");
    await exigerSuperAdmin(context.supabase, context.userId);
    await supprimer(context.supabase, data.livretId);
    return { ok: true };
  });

async function supprimer(
  supabase: import("./acces.server.ts").Client,
  livretId: string,
): Promise<void> {
  const { data: l } = await supabase
    .from("livrets")
    .select("site_id")
    .eq("id", livretId)
    .maybeSingle();
  if (!l) return;
  const dossier = `${l.site_id}/${livretId}`;
  const chemins: string[] = [];
  for (const sous of [dossier, `${dossier}/images`]) {
    const { data: fichiers } = await supabase.storage.from("livrets").list(sous, { limit: 1000 });
    for (const f of fichiers ?? []) if (f.id) chemins.push(`${sous}/${f.name}`);
  }
  if (chemins.length) await supabase.storage.from("livrets").remove(chemins);
  await supabase.from("livrets").delete().eq("id", livretId);
}
