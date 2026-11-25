import { describe, expect, it } from "vitest";
import { rolePourConnexionStore } from "./connexion-store.roles";

describe("rolePourConnexionStore", () => {
  it.each(["aurelie.godin@nova-serenity.fr", "fabien.scheltien@nova-serenity.fr"])(
    "attribue super_admin à l'administratrice ou l'administrateur NOVA %s",
    (email) => {
      expect(rolePourConnexionStore(email, "hotesse")).toBe("super_admin");
    },
  );

  it("attribue super_admin quand Nova Store fournit ce rôle", () => {
    expect(rolePourConnexionStore("gestionnaire@example.fr", "super_admin")).toBe("super_admin");
  });

  it("attribue hotesse aux autres comptes", () => {
    expect(rolePourConnexionStore("accueil@example.fr", "hotesse")).toBe("hotesse");
  });
});
