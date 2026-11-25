import type { ContenuJeton } from "./jeton-store";

export type RoleNovaAssist = "super_admin" | "hotesse";

const ADMINISTRATEURS_NOVA = new Set([
  "aurelie.godin@nova-serenity.fr",
  "fabien.scheltien@nova-serenity.fr",
]);

/** Rôle Nova Store → rôle Nova Assist (« accueil » devient « hotesse »). */
export function rolePourConnexionStore(email: string, role: ContenuJeton["role"]): RoleNovaAssist {
  return ADMINISTRATEURS_NOVA.has(email.toLowerCase()) || role === "super_admin"
    ? "super_admin"
    : "hotesse";
}
