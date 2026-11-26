import { describe, expect, it } from "vitest";
import { signerSync, verifierSync } from "./sync-sites";
const S = "x".repeat(32);
const corps = '{"sites":[]}';
describe("synchronisation des sites", () => {
  it("accepte un envoi signé récent", async () => {
    const t = String(Date.now());
    expect(await verifierSync(S, t, await signerSync(S, t, corps), corps)).toBe(true);
  });
  it("refuse un envoi non signé", async () => {
    expect(await verifierSync(S, String(Date.now()), null, corps)).toBe(false);
  });
  it("refuse un envoi de plus de 5 minutes", async () => {
    const t = String(Date.now() - 6 * 60_000);
    expect(await verifierSync(S, t, await signerSync(S, t, corps), corps)).toBe(false);
  });
  it("refuse un corps modifié", async () => {
    const t = String(Date.now());
    expect(await verifierSync(S, t, await signerSync(S, t, corps), '{"sites":[1]}')).toBe(false);
  });
});
