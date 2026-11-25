import { z } from "zod";

export const DUREE_JETON_STORE_MS = 60_000;

const schemaJetonStore = z.object({
  email: z.string().trim().email(),
  site: z.string().uuid(),
  nomSite: z.string().trim().min(1).max(120),
  role: z.enum(["super_admin", "hotesse"]),
  exp: z.number(),
});

export type JetonStore = z.infer<typeof schemaJetonStore>;

function decoderBase64Url(valeur: string): Uint8Array<ArrayBuffer> {
  const base64 = valeur.replace(/-/g, "+").replace(/_/g, "/");
  const complet = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binaire = atob(complet);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
  return octets;
}

function decoderSignature(signature: string): Uint8Array<ArrayBuffer> {
  if (/^[0-9a-f]{64}$/i.test(signature)) {
    const octets = new Uint8Array(32);
    for (let i = 0; i < octets.length; i += 1) {
      const valeur = signature.slice(i * 2, i * 2 + 2);
      octets[i] = Number.parseInt(valeur, 16);
    }
    return octets;
  }
  return decoderBase64Url(signature);
}

function erreurJeton(): Error {
  return new Error("Le lien de connexion Nova Store est invalide ou expiré.");
}

/** Vérifie le corps et la signature HMAC-SHA256 d'un jeton Nova Store de 60 secondes. */
export async function verifierJeton(secret: string, jeton: string): Promise<JetonStore> {
  if (!secret) throw new Error("La connexion Nova Store n'est pas configurée.");

  try {
    const [corps, signature, ...reste] = jeton.split(".");
    if (!corps || !signature || reste.length > 0) throw erreurJeton();

    const cle = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const signatureValide = await crypto.subtle.verify(
      "HMAC",
      cle,
      decoderSignature(signature),
      new TextEncoder().encode(corps),
    );
    if (!signatureValide) throw erreurJeton();

    const donnees = schemaJetonStore.parse(
      JSON.parse(new TextDecoder().decode(decoderBase64Url(corps))),
    );
    // Nova Store utilise des secondes Unix ; les millisecondes sont également acceptées.
    const expiration = donnees.exp < 1_000_000_000_000 ? donnees.exp * 1000 : donnees.exp;
    const maintenant = Date.now();
    if (
      !Number.isFinite(expiration) ||
      expiration <= maintenant ||
      expiration - maintenant > DUREE_JETON_STORE_MS
    ) {
      throw erreurJeton();
    }

    return { ...donnees, email: donnees.email.toLowerCase() };
  } catch (erreur) {
    if (
      erreur instanceof Error &&
      erreur.message === "La connexion Nova Store n'est pas configurée."
    ) {
      throw erreur;
    }
    throw erreurJeton();
  }
}
