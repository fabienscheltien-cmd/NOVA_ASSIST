"""Génère des livrets PowerPoint et Word de test à partir des transcriptions de docs/livrets-exemples.

Usage : python3 scripts/generer-livrets-test.py
Produit tests/fixtures/*.pptx et *.docx (jeu d'essai pour l'extraction et pour Nova Assist).
"""
import io, re, sys
from pathlib import Path
from pptx import Presentation
from pptx.util import Emu, Pt
from docx import Document

RACINE = Path(__file__).resolve().parent.parent
SOURCES = RACINE / "docs" / "livrets-exemples"
SORTIE = RACINE / "tests" / "fixtures"

# Image de test : le petit portrait de Serenity.
PNG = (RACINE / "src" / "assets" / "serenity_avatar.jpg").read_bytes()


def diapositives(md: str):
    parts = re.split(r"^## Diapositive (\d+)\s*$", md, flags=re.M)
    for i in range(1, len(parts), 2):
        yield int(parts[i]), parts[i + 1]


def morceaux(corps: str):
    """Séquence de ('texte', [lignes]) | ('table', [[cellules]]) | ('image', None)."""
    res, texte, table = [], [], []
    def vider():
        nonlocal texte, table
        if texte: res.append(("texte", texte)); texte = []
        if table: res.append(("table", table)); table = []
    for ligne in corps.splitlines():
        l = ligne.strip()
        if not l:
            continue
        if l.startswith("|"):
            if texte: res.append(("texte", texte)); texte = []
            if re.fullmatch(r"\|[\s\-|:]+\|", l):
                continue
            table.append([c.strip() for c in l.strip("|").split("|")])
        elif l == "[image]":
            vider(); res.append(("image", None))
        else:
            if table: res.append(("table", table)); table = []
            texte.append(l)
    vider()
    return res


def pptx(md: str, cible: Path):
    prs = Presentation()
    prs.slide_width, prs.slide_height = Emu(12192000), Emu(6858000)
    vide = prs.slide_layouts[6]
    for _, corps in diapositives(md):
        s = prs.slides.add_slide(vide)
        y = 200000
        for genre, val in morceaux(corps):
            if genre == "image":
                s.shapes.add_picture(io.BytesIO(PNG), Emu(400000), Emu(y), Emu(300000), Emu(300000))
                y += 350000
            elif genre == "texte":
                tb = s.shapes.add_textbox(Emu(400000), Emu(y), Emu(11000000), Emu(300000 * len(val)))
                tf = tb.text_frame
                for k, l in enumerate(val):
                    p = tf.paragraphs[0] if k == 0 else tf.add_paragraph()
                    p.text = l
                    p.font.size = Pt(12)
                y += 300000 * len(val) + 50000
            else:
                cols = max(len(r) for r in val)
                gf = s.shapes.add_table(len(val), cols, Emu(400000), Emu(y), Emu(11000000), Emu(250000 * len(val)))
                for r, row in enumerate(val):
                    for c in range(cols):
                        gf.table.cell(r, c).text = row[c] if c < len(row) else ""
                y += 250000 * len(val) + 50000
    prs.save(cible)


def docx(md: str, cible: Path):
    d = Document()
    for n, corps in diapositives(md):
        d.add_heading(f"Page {n}", level=1)
        for genre, val in morceaux(corps):
            if genre == "texte":
                for l in val:
                    d.add_paragraph(l)
            elif genre == "table":
                cols = max(len(r) for r in val)
                t = d.add_table(rows=len(val), cols=cols)
                for r, row in enumerate(val):
                    for c in range(cols):
                        t.cell(r, c).text = row[c] if c < len(row) else ""
            else:
                d.add_picture(io.BytesIO(PNG))
    d.save(cible)


if __name__ == "__main__":
    SORTIE.mkdir(parents=True, exist_ok=True)
    for src in sorted(SOURCES.glob("*.md")):
        md = src.read_text(encoding="utf-8")
        pptx(md, SORTIE / (src.stem + ".pptx"))
        docx(md, SORTIE / (src.stem + ".docx"))
        print("ok", src.stem)
