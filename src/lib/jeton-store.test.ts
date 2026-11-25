import { describe, expect, it } from "vitest";
import { DUREE_JETON_STORE_MS, verifierJeton } from "./jeton-store";

const SECRET = "secret-de-test";

function base64Url(valeur: string | ArrayBuffer): string {
  const octets =
    typeof valeur === "string" ? new TextEncoder().encode(valeur) : new Uint8Array(valeur);
  let binaire = "";
  for (const octet of octets) binaire += String.fromCharCode(octet);
  return btoa(binaire).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function creerJeton(valeurs: Record<string, unknown>): Promise<string> {
  const corps = base64Url(JSON.stringify(valeurs));
  const cle = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cle, new TextEncoder().encode(corps));
  return `${corps}.${base64Url(signature)}`;
}

function valeursValides() {
  return {
    email: "Hotesse@Example.fr",
    site: "d6f74aa2-0ea4-4b3e-b9a6-e6b981c1e203",
    nomSite: "Nova République",
    role: "hotesse",
    exp: Date.now() + DUREE_JETON_STORE_MS,
  };
}

describe("verifierJeton", () => {
  it("accepte un jeton signé valable 60 secondes et normalise l'e-mail", async () => {
    const jeton = await creerJeton(valeursValides());
    await expect(verifierJeton(SECRET, jeton)).resolves.toMatchObject({
      email: "hotesse@example.fr",
      nomSite: "Nova République",
      role: "hotesse",
    });
  });

  it("refuse un jeton dont le contenu a été modifié", async () => {
    const jeton = await creerJeton(valeursValides());
    const signature = jeton.split(".")[1];
    const corpsModifie = base64Url(JSON.stringify({ ...valeursValides(), role: "super_admin" }));
    await expect(verifierJeton(SECRET, `${corpsModifie}.${signature}`)).rejects.toThrow(
      "invalide ou expiré",
    );
  });

  it("refuse un jeton expiré", async () => {
    const jeton = await creerJeton({ ...valeursValides(), exp: Date.now() - 1 });
    await expect(verifierJeton(SECRET, jeton)).rejects.toThrow("invalide ou expiré");
  });

  it("refuse une validité supérieure à 60 secondes", async () => {
    const jeton = await creerJeton({
      ...valeursValides(),
      exp: Date.now() + DUREE_JETON_STORE_MS + 1000,
    });
    await expect(verifierJeton(SECRET, jeton)).rejects.toThrow("invalide ou expiré");
  });

  it("accepte une expiration Unix exprimée en secondes", async () => {
    const jeton = await creerJeton({
      ...valeursValides(),
      exp: Math.floor(Date.now() / 1000) + 60,
    });
    await expect(verifierJeton(SECRET, jeton)).resolves.toMatchObject({ role: "hotesse" });
  });
});
