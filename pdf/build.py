#!/usr/bin/env python3
"""Builds the A4 PDF with the speech text AND the presenter notes of the deck from one file:

    python3 pdf/build.py        # reads pdf/speech.md → PDF + src/data/notes.ts

Edit pdf/speech.md to change the text. Needs Google Chrome (headless print-to-pdf).
"""
import html
import json
import pathlib
import re
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
TITLE = "Мода як форма культурного самовираження — текст виступу та презентації"
OUT = ROOT / f"{TITLE}.pdf"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
e = html.escape


def parse(md: str):
    md = re.sub(r"<!--.*?-->", "", md, flags=re.S)
    title = re.search(r"^# (.+)$", md, re.M).group(1).strip()
    sub = re.search(r"^# .+\n+(.+)$", md, re.M).group(1).strip()
    slides, sources = [], []
    for block in re.split(r"^## ", md, flags=re.M)[1:]:
        head, _, body = block.partition("\n")
        body = body.strip()
        if head.strip() == "Джерела":
            sources = [ln[2:].strip() for ln in body.splitlines() if ln.startswith("- ")]
            continue
        n, name, sec = [x.strip() for x in head.split("·")]
        paras = [p.strip().replace("\n", " ") for p in re.split(r"\n\s*\n", body) if p.strip()]
        slides.append((int(n), name, int(sec), paras))
    return title, sub, slides, sources


def md_inline(t: str) -> str:
    return re.sub(r"\*(.+?)\*", r"<i>\1</i>", e(t))


def write_notes(slides):
    out = ["export interface Note {", "  /** Орієнтовний час на слайд, секунд */", "  seconds: number", "  /** Що сказати усно: абзаци */", "  text: string[]", "}", "", "// Згенеровано з pdf/speech.md скриптом pdf/build.py — редагуйте speech.md.", "export const notes: Note[] = ["]
    for _, _, sec, paras in slides:
        out.append(f"  {{ seconds: {sec}, text: [")
        out += [f"    {json.dumps(p, ensure_ascii=False)}," for p in paras]
        out.append("  ] },")
    out.append("]")
    (ROOT / "src/data/notes.ts").write_text("\n".join(out) + "\n", encoding="utf-8")


# ───────────────────────── rendering ─────────────────────────


def font_faces() -> str:
    faces = []
    cy = "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116"
    la = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"
    for sub, rng in (("cyrillic", cy), ("latin", la)):
        for w in (400, 500, 600):
            for st in ("normal", "italic"):
                faces.append(
                    f"@font-face{{font-family:'Cormorant';font-style:{st};font-weight:{w};src:url('fonts/cormorant-garamond-{sub}-{w}-{st}.woff2') format('woff2');unicode-range:{rng};}}"
                )
        for w in (400, 500, 600):
            faces.append(
                f"@font-face{{font-family:'InterPDF';font-style:normal;font-weight:{w};src:url('fonts/inter-{sub}-{w}-normal.woff2') format('woff2');unicode-range:{rng};}}"
            )
    return "\n".join(faces)


def build_html(title, sub, slides, sources) -> str:
    total = sum(s[2] for s in slides)
    body = [f"""
<section class="cover">
  <div class="cover-top"><span>Текст виступу</span><span>≈ {round(total / 60, 1)} хв</span></div>
  <div class="cover-main">
    <svg class="mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1 L23 12 L12 23 L1 12Z" fill="none" stroke="#7C1F2B" stroke-width="1.2"/><path d="M12 7 L17 12 L12 17 L7 12Z" fill="#7C1F2B"/></svg>
    <h1>Мода як форма <em>культурного самовираження</em></h1>
    <p class="sub">Текст публічного виступу</p>
  </div>
  <div class="cover-bottom"><p>{e(sub)}</p></div>
</section>
<main class="text">"""]
    for n, name, sec, paras in slides:
        if n == 11:
            continue
        body.append(f'<section class="slide"><div class="head"><span class="num">{n:02d}</span><h2>{e(name)}</h2><span class="time">{sec} с</span></div>')
        body += [f"<p>{md_inline(p)}</p>" for p in paras]
        body.append("</section>")
    body.append('<section class="slide src"><div class="head"><span class="num">—</span><h2>Джерела</h2></div><ol>')
    body += [f"<li>{md_inline(x)}</li>" for x in sources]
    body.append("</ol></section></main>")
    css = f"""
{font_faces()}
@page {{ size: A4; margin: 22mm 22mm 20mm 22mm; background: #F6F3ED;
  @bottom-center {{ content: counter(page); font: 500 9pt 'Cormorant', serif; color: #77736C; }} }}
@page :first {{ @bottom-center {{ content: none }} }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
html, body {{ background: #F6F3ED; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
body {{ font-family: 'Cormorant', Georgia, serif; font-size: 13pt; line-height: 1.5; color: #151515; }}
em, i {{ font-style: italic; }}
.cover {{ height: 255mm; display: flex; flex-direction: column; justify-content: space-between; break-after: page; }}
.cover-top {{ display: flex; justify-content: space-between; font: 500 7pt 'InterPDF', sans-serif; letter-spacing: .24em; text-transform: uppercase; color: #77736C; }}
.cover-main {{ margin-top: 55mm; }}
.cover .mark {{ width: 9mm; height: 9mm; margin-bottom: 12mm; display: block; }}
.cover h1 {{ font-weight: 500; font-size: 50pt; line-height: .98; letter-spacing: -.01em; max-width: 150mm; }}
.cover h1 em {{ display: block; font-weight: 400; margin-top: 2mm; color: #7C1F2B; }}
.cover .sub {{ margin-top: 12mm; font-size: 14pt; color: #55524c; border-top: .3mm solid #151515; padding-top: 6mm; max-width: 95mm; }}
.cover-bottom p {{ font: 500 8pt 'InterPDF', sans-serif; letter-spacing: .22em; text-transform: uppercase; color: #77736C; }}
.slide {{ break-inside: avoid; padding: 5mm 0 4mm; border-top: .3mm solid #151515; margin-top: 5mm; }}
.slide:first-child {{ margin-top: 0; }}
.head {{ display: flex; align-items: baseline; gap: 5mm; margin-bottom: 3mm; }}
.num {{ font: 600 8pt 'InterPDF', sans-serif; letter-spacing: .18em; color: #7C1F2B; min-width: 8mm; }}
h2 {{ font-weight: 600; font-size: 16pt; line-height: 1.15; flex: 1; }}
.time {{ font: 500 7.5pt 'InterPDF', sans-serif; color: #77736C; }}
.slide p {{ margin: 0 0 2.6mm 13mm; orphans: 3; widows: 3; }}
.src ol {{ margin-left: 13mm; padding-left: 5mm; font: 400 8.6pt/1.5 'InterPDF', sans-serif; }}
.src li {{ margin-bottom: 1.6mm; }}
"""
    return f"""<!doctype html><html lang="uk"><head><meta charset="utf-8"><title>{e(TITLE)}</title><style>{css}</style></head><body>
{''.join(body)}
</body></html>"""


def main():
    title, sub, slides, sources = parse((HERE / "speech.md").read_text(encoding="utf-8"))
    write_notes(slides)
    src = HERE / "source.html"
    src.write_text(build_html(title, sub, slides, sources), encoding="utf-8")
    cmd = [CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--allow-file-access-from-files",
           f"--print-to-pdf={OUT}", "--virtual-time-budget=8000", src.as_uri()]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0 or not OUT.exists():
        print(r.stdout, r.stderr, file=sys.stderr)
        sys.exit(1)
    print("OK:", OUT, OUT.stat().st_size // 1024, "KB; notes.ts updated")


if __name__ == "__main__":
    main()
