/**
 * Déversement des sites Nova Store → Nova Assist.
 * Nova Store envoie POST /api/public/sites/sync avec :
 *  - en-tête x-nova-horodatage : millisecondes depuis 1970
 *  - en-tête x-nova-signature : HMAC-SHA256 (base64url) de `${horodatage}.${corps}` avec NOVA_STORE_SSO_SECRET
 *  - corps JSON : { "sites": [{ "id": uuid, "nom": string, "ville"?: string | null }] }
 */
import { z } from "zod";

export const FENETRE_SYNC_MS = 5 * 60_000;
export const schemaSync = z.object({
  sites: z
    .array(
      z.object({
        id: z.string().uuid(),
        nom: z.string().trim().min(1).max(120),
        ville: z.string().trim().max(120).nullish(),
      }),
    )
    .min(1)
    .max(500),
});

const enc = new TextEncoder();
function b64url(o: Uint8Array): string {
  let s = "";
  for (const x of o) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function signerSync(secret: string, horodatage: string, corps: string): Promise<string> {
  const cle = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", cle, enc.encode(`${horodatage}.${corps}`))));
}
function egal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export async function verifierSync(
  secret: string,
  horodatage: string | null,
  signature: string | null,
  corps: string,
  maintenant = Date.now(),
): Promise<boolean> {
  if (secret.length < 32 || !horodatage || !signature) return false;
  const t = Number(horodatage);
  if (!Number.isFinite(t) || Math.abs(maintenant - t) > FENETRE_SYNC_MS) return false;
  return egal(await signerSync(secret, horodatage, corps), signature);
}
