import type { ReactNode } from "react";
import logoSerenity from "@/assets/logo-nova-serenity.svg";
import logoNova from "@/assets/logo-nova.svg";

/**
 * En-tête commun aux outils NOVA (même gabarit que Nova Desk) : bandeau marine pleine largeur,
 * logo NOVA Serenity à gauche, « NOVA ASSIST » au centre, actions à droite.
 */
export function EnTete({ actions }: { actions?: ReactNode }) {
  return (
    <header className="appbar">
      <div className="appbar-in">
        <a
          className="appbar-left"
          href="https://www.nova-serenity.fr"
          aria-label="NOVA Serenity – site internet"
        >
          <img className="logo-serenity" src={logoSerenity} alt="NOVA Serenity" />
        </a>
        <div className="appbar-center">
          <img className="logo-nova" src={logoNova} alt="NOVA" />
          <span>ASSIST</span>
        </div>
        <nav className="appbar-right" aria-label="Accès">
          {actions}
        </nav>
      </div>
    </header>
  );
}
