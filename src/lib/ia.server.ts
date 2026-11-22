/**
 * Accès à l'IA via la passerelle Lovable AI (même configuration que Nova Pass).
 * Serveur uniquement : la clé LOVABLE_API_KEY n'est jamais envoyée au navigateur.
 */
import { extraireJson } from "./ia/prompts.ts";

/** Modèle des analyses de livrets (dépôt par le Super Admin, rare). */
export const MODELE_IA = process.env["NOVA_IA_MODELE"] || "openai/gpt-6-astra";

/**
 * Modèle de Serenity (questions des hôtesses, fréquentes) : un modèle léger et économique,
 * pour tenir dans le quota IA gratuit de Lovable. Modifiable sans toucher au code (NOVA_IA_MODELE_SERENITY).
 */
export const MODELE_SERENITY = process.env["NOVA_IA_MODELE_SERENITY"] || "google/gemini-3.8-flash";

export class ErreurIA extends Error {}

export async function demanderIA(opts: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  effort?: "low" | "medium" | "high";
  modele?: string;
}): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new ErreurIA("L'IA n'est pas configurée (clé LOVABLE_API_KEY absente).");

  const { createOpenAI } = await import("@ai-sdk/openai");
  const { generateText } = await import("ai");
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });

  try {
    const modele = opts.modele ?? MODELE_IA;
    // Modèles OpenAI : API « responses » avec raisonnement ; autres modèles (Gemini…) : API chat standard.
    const result = modele.startsWith("openai/")
      ? await generateText({
          model: provider.responses(modele),
          system: opts.system,
          messages: opts.messages,
          maxRetries: 1,
          providerOptions: {
            openai: {
              store: false,
              forceReasoning: true,
              reasoningEffort: opts.effort ?? "low",
              include: ["reasoning.encrypted_content"],
            },
          },
        })
      : await generateText({
          model: provider.chat(modele),
          system: opts.system,
          messages: opts.messages,
          maxRetries: 1,
        });
    return result.text;
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    console.error("IA", status, e);
    throw new ErreurIA(
      status === 429
        ? "Trop de demandes à l'IA, réessayez dans un instant."
        : status === 402
          ? "Crédits IA épuisés pour l'espace de travail."
          : status === 403
            ? "Accès à l'IA refusé."
            : "L'IA n'a pas pu répondre.",
    );
  }
}

/** Demande une réponse JSON à l'IA et la lit (une seconde tentative si le JSON est illisible). */
export async function demanderJson(
  system: string,
  question: string,
  effort: "low" | "medium" | "high" = "medium",
): Promise<unknown> {
  for (let essai = 0; essai < 2; essai++) {
    const texte = await demanderIA({
      system,
      messages: [{ role: "user", content: question }],
      effort,
    });
    try {
      return extraireJson(texte);
    } catch {
      /* nouvelle tentative */
    }
  }
  throw new ErreurIA("Réponse de l'IA illisible.");
}
