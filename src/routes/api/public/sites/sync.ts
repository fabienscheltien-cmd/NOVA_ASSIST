import { createFileRoute } from "@tanstack/react-router";
import { schemaSync, verifierSync } from "@/lib/sync-sites";

export const Route = createFileRoute("/api/public/sites/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["NOVA_STORE_SSO_SECRET"] ?? "";
        const corps = await request.text();
        const ok = await verifierSync(
          secret,
          request.headers.get("x-nova-horodatage"),
          request.headers.get("x-nova-signature"),
          corps,
        );
        if (!ok) return new Response("Signature invalide", { status: 401 });
        let json: unknown;
        try {
          json = JSON.parse(corps);
        } catch {
          return new Response("JSON invalide", { status: 400 });
        }
        const parse = schemaSync.safeParse(json);
        if (!parse.success) return new Response("Données invalides", { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const lignes = parse.data.sites.map((s) => ({ id: s.id, nom: s.nom, ville: s.ville ?? null }));
        const { error } = await supabaseAdmin.from("sites").upsert(lignes, { onConflict: "id" });
        if (error) return new Response("Enregistrement impossible", { status: 500 });
        return Response.json({ ok: true, recus: lignes.length });
      },
    },
  },
});
