import { createContext, useContext, useSyncExternalStore } from "react";
import type { SourceReponse } from "./ia/prompts.ts";

/** Ce que l'espace connecté partage avec ses onglets : compte, site courant, conversations. */
export type Espace = {
  estSuperAdmin: boolean;
  email: string;
  siteId: string | null;
  siteNom: string | null;
  conversation: MessageChat[];
  setConversation: (f: (avant: MessageChat[]) => MessageChat[]) => void;
  /** Message bref en bas d'écran (« toast » de la maquette). */
  notifier: (message: string) => void;
};

export type MessageChat =
  | { id: string; de: "user"; texte: string }
  | { id: string; de: "bot"; texte: string; sources: SourceReponse[]; inconnu: boolean }
  | { id: string; de: "erreur"; texte: string };

export const EspaceContext = createContext<Espace | null>(null);

export function useEspace(): Espace {
  const e = useContext(EspaceContext);
  if (!e) throw new Error("useEspace hors de l'espace connecté");
  return e;
}

/* Site choisi par le Super Admin, mémorisé dans le navigateur. */
const CLE = "nova-assist:site";
const abonnes = new Set<() => void>();

function lireSite(): string {
  try {
    return localStorage.getItem(CLE) ?? "";
  } catch {
    return "";
  }
}

export function choisirSite(id: string) {
  try {
    if (id) localStorage.setItem(CLE, id);
    else localStorage.removeItem(CLE);
  } catch {
    /* stockage indisponible : le choix vaut pour la session en cours */
  }
  memoire = id;
  abonnes.forEach((f) => f());
}

let memoire: string | null = null;

export function useSiteChoisi(): string {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => memoire ?? lireSite(),
    () => "",
  );
}
