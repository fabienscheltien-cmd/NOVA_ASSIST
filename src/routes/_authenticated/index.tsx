import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { poserQuestion } from "@/lib/assistant.functions";
import { listerLivrets } from "@/lib/livrets.functions";
import { useEspace, type MessageChat } from "@/lib/espace";
import { Texte } from "@/components/Texte";
import serenity from "@/assets/serenity_full.jpg";

export const Route = createFileRoute("/_authenticated/")({
  component: PageSerenity,
});

const BIENVENUE =
  "Posez-moi votre question sur nos hôtes et hôtesses d'accueil, la conciergerie, le courrier, les colis ou nos tarifs.";

function PageSerenity() {
  const { siteId, siteNom, estSuperAdmin, conversation, setConversation } = useEspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const demander = useServerFn(poserQuestion);
  const chargerLivrets = useServerFn(listerLivrets);
  const { data: livrets } = useQuery({
    queryKey: ["livrets", siteId],
    queryFn: () => chargerLivrets({ data: { siteId: siteId as string } }),
    enabled: !!siteId,
  });
  const publies = (livrets ?? []).filter((l) => l.statut === "publie").length;

  const [question, setQuestion] = useState("");
  const [enCours, setEnCours] = useState(false);
  const fil = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fil.current?.scrollTo({ top: fil.current.scrollHeight });
  }, [conversation.length, enCours]);

  if (!siteId) {
    return (
      <div className="glass empty">
        Aucun site pour le moment. Créez d'abord un site dans{" "}
        <Link to="/sites">Sites et comptes</Link>.
      </div>
    );
  }

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    const texte = question.trim();
    if (texte.length < 2 || enCours || !siteId) return;
    setQuestion("");
    const historique = conversation
      .filter((m): m is Extract<MessageChat, { de: "user" | "bot" }> => m.de !== "erreur")
      .slice(-6)
      .map((m) => ({
        role: m.de === "user" ? ("user" as const) : ("assistant" as const),
        content: m.texte,
      }));
    setConversation((c) => [...c, { id: crypto.randomUUID(), de: "user", texte }]);
    setEnCours(true);
    try {
      const r = await demander({ data: { siteId, question: texte, historique } });
      setConversation((c) => [
        ...c,
        r.ok
          ? {
              id: crypto.randomUUID(),
              de: "bot",
              texte: r.reponse,
              sources: r.sources,
              inconnu: !r.trouve,
            }
          : { id: crypto.randomUUID(), de: "erreur", texte: r.erreur },
      ]);
      if (r.ok && !r.trouve && estSuperAdmin) {
        void queryClient.invalidateQueries({ queryKey: ["compteurs", siteId] });
      }
    } catch {
      setConversation((c) => [
        ...c,
        {
          id: crypto.randomUUID(),
          de: "erreur",
          texte: "Serenity n'a pas pu répondre. Réessayez dans un instant.",
        },
      ]);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="chat-layout">
      <section className="glass chat" aria-label="Conversation avec Serenity">
        <div className="chat-head">
          <span>
            <b>Site {siteNom}</b> ·{" "}
            {publies === 0 ? "aucun livret" : publies === 1 ? "1 livret" : `${publies} livrets`}
          </span>
          <span>Réponses fondées sur les livrets</span>
        </div>
        <div className="msgs" ref={fil} aria-live="polite">
          {conversation.length === 0 && (
            <div className="bubble hello">
              <strong>Bonjour, je suis Serenity !</strong> {BIENVENUE}
            </div>
          )}
          {conversation.map((m) =>
            m.de === "user" ? (
              <div key={m.id} className="bubble user">
                {m.texte}
              </div>
            ) : m.de === "erreur" ? (
              <div key={m.id} className="bubble error">
                {m.texte}
              </div>
            ) : (
              <div key={m.id} className={`bubble bot${m.inconnu ? " unknown" : ""}`}>
                <Texte texte={m.texte} />
                {m.sources.length > 0 && (
                  <div className="src">
                    {m.sources.map((s) =>
                      s.type === "livret" ? (
                        <button
                          key={`${s.livretId}-${s.page}`}
                          type="button"
                          className="chip"
                          onClick={() =>
                            navigate({
                              to: "/detail",
                              search: { livret: s.livretId, page: s.page },
                            })
                          }
                        >
                          {s.livretTitre} · p. {s.page}
                        </button>
                      ) : (
                        <button
                          key={s.complementId}
                          type="button"
                          className="chip compl"
                          onClick={() =>
                            navigate({ to: "/detail", search: { livret: "complements" } })
                          }
                        >
                          Complément ajouté par l'administrateur
                        </button>
                      ),
                    )}
                  </div>
                )}
              </div>
            ),
          )}
          {enCours && <div className="typing">Serenity écrit…</div>}
        </div>
        <form className="composer" onSubmit={envoyer}>
          <input
            type="text"
            autoComplete="off"
            maxLength={800}
            placeholder="Ex. : Quel est le prix d'une chemise ?"
            aria-label="Votre question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button
            className="btn gold"
            type="submit"
            disabled={enCours || question.trim().length < 2}
          >
            Envoyer
          </button>
        </form>
        <div className="hint">
          Serenity répond uniquement d'après les livrets du site. Si elle ne sait pas, la question
          est transmise à l'administratrice.
        </div>
      </section>
      <aside className="serenity">
        <div className="greet">
          <strong>Bonjour, je suis Serenity !</strong> {BIENVENUE}
        </div>
        <img className="face" src={serenity} alt="Serenity, l'assistante Nova Assist" />
      </aside>
    </div>
  );
}
