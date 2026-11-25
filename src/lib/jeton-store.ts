/**
 * Jeton de connexion unique Nova Store → applications NOVA (même fichier dans les deux projets).
 *
 * Le Store signe, avec un secret partagé (variable serveur NOVA_STORE_SSO_SECRET, identique
 * dans les deux projets), « qui » ouvre l'application et pour quel site. L'application vérifie
 * la signature et la date d'expiration (60 s), puis ouvre elle-même la session de son compte.
 * Aucun mot de passe ni aucune clé de base de données ne circule.
 * Le format reste compatible : une application qui ignore un champ facultatif l'accepte.
 */
export type ContenuJeton = {
  v: 1;
  /** Identifiant du site dans l'application ouverte (ex. id du site Nova Pass). */
  site: string;
  /** Nom du site (facultatif, affichage). Champ ajouté sans changer la vérification. */
  nomSite?: string;
  role: "accueil" | "super_admin";
  /** E-mail du compte Store (sert à retrouver le super admin dans l'application). */
  email: string;
  /** Expiration, en millisecondes depuis 1970. */
  exp: number;
  /** Valeur aléatoire : deux jetons ne sont jamais identiques. */
  n: string;
};
export const DUREE_JETON_MS = 60_000;
const enc = new TextEncoder();
function b64url(octets: Uint8Array): string {
  let s = "";
  for (const o of octets) s += String.fromCharCode(o);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function deB64url(texte: string): Uint8Array {
  const s = atob(texte.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((texte.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}
async function signer(secret: string, donnees: string): Promise<string> {
  const cle = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", cle, enc.encode(donnees))));
}
/** Comparaison en temps constant (évite de deviner la signature octet par octet). */
function egal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export async function creerJeton(
  secret: string,
  contenu: Omit<ContenuJeton, "v" | "exp" | "n">,
  maintenant = Date.now(),
): Promise<string> {
  if (secret.length < 32) throw new Error("Secret de connexion unique trop court (32 caractères minimum).");
  const alea = new Uint8Array(12);
  crypto.getRandomValues(alea);
  const corps: ContenuJeton = { v: 1, ...contenu, exp: maintenant + DUREE_JETON_MS, n: b64url(alea) };
  const donnees = b64url(enc.encode(JSON.stringify(corps)));
  return `${donnees}.${await signer(secret, donnees)}`;
}
/** Renvoie le contenu si le jeton est authentique et non expiré, sinon une erreur lisible. */
export async function verifierJeton(
  secret: string,
  jeton: string,
  maintenant = Date.now(),
): Promise<ContenuJeton> {
  if (secret.length < 32) throw new Error("Connexion unique non configurée.");
  const [donnees, signature, reste] = jeton.split(".");
  if (!donnees || !signature || reste !== undefined) throw new Error("Lien de connexion invalide.");
  if (!egal(await signer(secret, donnees), signature)) throw new Error("Lien de connexion invalide.");
  let c: ContenuJeton;
  try {
    c = JSON.parse(new TextDecoder().decode(deB64url(donnees)));
  } catch {
    throw new Error("Lien de connexion invalide.");
  }
  if (c.v !== 1 || !c.site || (c.role !== "accueil" && c.role !== "super_admin") || !c.email)
    throw new Error("Lien de connexion invalide.");
  if (typeof c.exp !== "number" || c.exp < maintenant || c.exp > maintenant + 2 * DUREE_JETON_MS)
    throw new Error("Ce lien de connexion a expiré. Rouvrez l'application depuis le Nova Store.");
  return c;
}
