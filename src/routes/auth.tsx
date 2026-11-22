import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EnTete } from "@/components/EnTete";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: Connexion,
});

/** Connexion propre à Nova Assist (e-mail + mot de passe). Pas de lien avec Nova Pass pour l'instant. */
function Connexion() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function seConnecter(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: motDePasse,
    });
    setEnvoi(false);
    if (error) {
      setErreur("E-mail ou mot de passe incorrect.");
      return;
    }
    navigate({ to: "/" });
  }

  return (
    <>
      <EnTete />
      <div className="wrap">
        <form className="glass auth-card" onSubmit={seConnecter}>
          <h2>Connexion</h2>
          <p className="sub" style={{ color: "var(--muted)", margin: 0 }}>
            Utilisez l'e-mail d'accueil de votre site ou votre compte administrateur.
          </p>
          <label>
            E-mail
            <input
              className="field"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Mot de passe
            <input
              className="field"
              type="password"
              autoComplete="current-password"
              required
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
            />
          </label>
          {erreur && <p className="err-text">{erreur}</p>}
          <div>
            <button className="btn gold" type="submit" disabled={envoi}>
              {envoi ? "Connexion…" : "Se connecter"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
