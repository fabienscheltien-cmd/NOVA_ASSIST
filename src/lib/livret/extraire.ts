import type { ResultatExtraction } from "./blocs.ts";

export type FormatLivret = "docx" | "pdf" | "pptx";

export function formatDuFichier(nom: string): FormatLivret | null {
  const ext = nom.toLowerCase().split(".").pop();
  return ext === "docx" || ext === "pdf" || ext === "pptx" ? ext : null;
}

/** Extraction côté navigateur selon le format (Word, PDF ou PowerPoint). */
export async function extraireLivret(fichier: File): Promise<ResultatExtraction> {
  const format = formatDuFichier(fichier.name);
  const contenu = await fichier.arrayBuffer();
  if (format === "pptx") return (await import("./pptx.ts")).extrairePptx(contenu);
  if (format === "docx") return (await import("./docx.ts")).extraireDocx(contenu);
  if (format === "pdf") return (await import("./pdf.ts")).extrairePdf(contenu);
  throw new Error("Format non pris en charge : déposez un fichier .docx, .pdf ou .pptx.");
}
