import { describe, expect, it } from "vitest";
import { DUREE_JETON_MS, creerJeton, verifierJeton } from "./jeton-store";

const SECRET = "secret-de-test-tres-long-de-32-caracteres!";
const contenu = {
  site: "d6f74aa2-0ea4-4b3e-b9a6-e6b981c1e203",
  nomSite: "Nova République",
  role: "accueil" as const,
  email: "accueil@example.fr",
};

describe("jeton Nova Store", () => {
  it("accepte un jeton émis par Nova Store", async () => {
    const j = await creerJeton(SECRET, contenu);
    await expect(verifierJeton(SECRET, j)).resolves.toMatchObject({ role: "accueil", v: 1 });
  });
  it("refuse un contenu modifié", async () => {
    const j = await creerJeton(SECRET, contenu);
    const autre = await creerJeton(SECRET, { ...contenu, role: "super_admin" });
    await expect(verifierJeton(SECRET, `${autre.split(".")[0]}.${j.split(".")[1]}`)).rejects.toThrow("invalide");
  });
  it("refuse un jeton expiré après 60 secondes", async () => {
    const t = Date.now();
    const j = await creerJeton(SECRET, contenu, t);
    await expect(verifierJeton(SECRET, j, t + DUREE_JETON_MS + 1)).rejects.toThrow("expiré");
  });
  it("refuse un secret de moins de 32 caractères", async () => {
    await expect(verifierJeton("court", "a.b")).rejects.toThrow("non configurée");
  });
});
