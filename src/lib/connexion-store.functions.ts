import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { verifierJeton } from "./jeton-store";
import { rolePourConnexionStore } from "./connexion-store.roles";

/** Échange le jeton Nova Store contre un lien de connexion Nova Assist à usage unique. */
export const preparerConnexionStore = createServerFn({ method: "POST" })
  .inputValidator((donnees: unknown) =>
    z.object({ jeton: z.string().min(1).max(8192) }).parse(donnees),
  )
  .handler(async ({ data }) => {
    const secret = process.env["NOVA_STORE_SSO_SECRET"];
    if (!secret) throw new Error("La connexion Nova Store n'est pas configurée.");
    const jeton = await verifierJeton(secret, data.jeton);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: erreurSite } = await supabaseAdmin
      .from("sites")
      .upsert({ id: jeton.site, nom: jeton.nomSite }, { onConflict: "id", ignoreDuplicates: true });
    if (erreurSite) throw new Error("Préparation du site impossible.");

    let utilisateur: { id: string; email?: string } | null = null;
    let page = 1;
    while (!utilisateur && page <= 100) {
      const { data: liste, error: erreurListe } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (erreurListe) throw new Error("Recherche du compte impossible.");
      utilisateur =
        liste.users.find((compte) => compte.email?.toLowerCase() === jeton.email) ?? null;
      if (liste.users.length < 1000) break;
      page += 1;
    }

    if (!utilisateur) {
      const { data: cree, error: erreurCreation } = await supabaseAdmin.auth.admin.createUser({
        email: jeton.email,
        email_confirm: true,
      });
      if (erreurCreation || !cree.user) throw new Error("Création du compte impossible.");
      utilisateur = cree.user;
    }

    const role = rolePourConnexionStore(jeton.email, jeton.role);
    const { error: erreurRole } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: utilisateur.id, role }, { onConflict: "user_id,role" });
    if (erreurRole) throw new Error("Attribution du rôle impossible.");

    const { error: erreurAncienRole } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", utilisateur.id)
      .neq("role", role);
    if (erreurAncienRole) throw new Error("Mise à jour du rôle impossible.");

    if (role !== "super_admin") {
      const { error: erreurMembre } = await supabaseAdmin
        .from("site_members")
        .upsert({ user_id: utilisateur.id, site_id: jeton.site }, { onConflict: "user_id" });
      if (erreurMembre) throw new Error("Rattachement au site impossible.");
    }

    const { data: lien, error: erreurLien } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: jeton.email,
    });
    const tokenHash = lien?.properties?.hashed_token;
    if (erreurLien || !tokenHash) throw new Error("Création de la session impossible.");

    return { token_hash: tokenHash, siteId: jeton.site };
  });
