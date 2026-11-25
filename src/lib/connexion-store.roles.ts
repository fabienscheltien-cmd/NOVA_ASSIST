import type { JetonStore } from "./jeton-store";

const ADMINISTRATEURS_NOVA = new Set([
  "aurelie.godin@nova-serenity.fr",
  "fabien.scheltien@nova-serenity.fr",
]);

export function rolePourConnexionStore(
  email: string,
  role: JetonStore["role"],
): JetonStore["role"] {
  return ADMINISTRATEURS_NOVA.has(email.toLowerCase()) || role === "super_admin"
    ? "super_admin"
    : "hotesse";
}
