# ESC Lab site (bsohn.net)

Static site for the Electronic Structure Control Lab, SKKU. No build step, no
framework — plain HTML/CSS/JS served straight from the repo root.

## Deploy

| | |
|---|---|
| Remote | **`esc`** — `github.com/esc-skku/esc-skku.github.io` (there is **no `origin`**) |
| Branch | `main` |
| Deploy | `.github/workflows/deploy.yml`, fires on push to `main`, takes ~1 min |
| Live at | `https://bsohn.net` (custom domain; `esc-skku.github.io` also serves it) |

```bash
git add -A simulations && git commit && git push esc main
```

Two things that regularly cause confusion:

- **The remote is `esc`, not `origin`.** A bare `git push` fails.
- **Pages are cached for 10 minutes** (`Cache-Control: max-age=600`, plus a
  Fastly edge cache). After a deploy the old page can still show in a browser
  that already visited it. Verify with `curl` (which skips the browser cache),
  and tell the user to hard-refresh (Ctrl+Shift+R) rather than assuming the
  deploy failed.

`.nojekyll` is present, so underscore-prefixed paths are served fine.
`sitemap.xml` only lists the site root — no need to touch it for new pages.

## Layout

```
index.html              # the whole main site — a hash-routed SPA, 150 KB, hand-maintained
image-slot.js           # image slot machinery for the main page
simulations/            # everything below is the simulations area
  index.html            #   hub: two section cards
  assets/sim.css        #   shared chrome for every index/chapter page
  research/index.html   #   section index for the research sims
  arpes/  topology/  bloch-wannier/  electron-diffraction/  tight-binding/
                        #   the research sims themselves — self-contained pages
  vacuum/               #   첨단 진공 물리 및 기술 (undergrad course)
    index.html          #     chapter list
    ch1/ … ch8/         #     one index.html per chapter + its material pages
```

The research simulations deliberately live at the *top* level
(`simulations/topology/…`), not under `research/`. `research/index.html` is
only a section index that links up and over with `../`. This keeps older deep
links working — don't "tidy" it by moving the files.

Every page under `simulations/` is standalone: open the `.html` and it works.
Only `tight-binding/tight_binding_t2g_eg.html` pulls anything external (Plotly
+ math.js from CDN).

## Adding a page

### 1. A course material (the usual case)

The user writes these as Claude artifacts and hands over a file from
`G:\내 드라이브\수업\2026_Spring_Vacuum_class\`. **They arrive as bare
fragments** — no `<html>`, `<head>`, or `<body>`, and they reference CSS
variables (`--surface-1`, `--surface-2`, `--border`, `--border-strong`,
`--text-primary`, `--text-secondary`, `--text-accent`, `--radius`) plus `--t`
for SVG strokes and `.th` / `.ts` / `.leader` classes for SVG labels. So they
must be wrapped, not copied.

Copy `vacuum/ch1/mcleod_gauge.html` as the template — the head block there
defines exactly what these fragments need. Paste the fragment between the
`<p class="lede">` and the `<footer>`, then adjust the breadcrumb, eyebrow,
`<h1>` and lede.

Then add a card to that chapter's `index.html`, and in `vacuum/index.html`
change the chapter's `<a class="card empty"` to `<a class="card"` and its
badge from `준비 중` to `N편`.

### 2. A research simulation

Drop the self-contained `.html` into a topic directory under `simulations/`
(make a new one if the topic is new), then add a card — and a `<h2 class="cat">`
if it's a new category — to `research/index.html`. Remember the hrefs there
start with `../`.

## Chapter titles

Taken from Chambers, *Modern Vacuum Physics*, which the course follows (the PDF
is in the user's `MD/` folder). **The course is a redesign for undergraduates,
so the week-by-week structure may not match — confirm with the user before
relying on these.**

1. 진공이란 무엇인가 · Introduction
2. 기체와 증기의 물리 · The Physics of Gases and Vapors
3. 기체의 분자적 기술 · The Molecular Description of Gases
4. 표면 과정과 아웃개싱 · Surface Processes and Outgassing
5. 기체 흐름과 배기 · Gas Flow and Pumping
6. 진공의 생성 — 펌프 · Creating a Vacuum — Pumps
7. 진공의 측정 — 게이지 · Measuring a Vacuum
8. 실제 진공 시스템 · Illustrative Examples and Representative Laboratory Systems

## Style

Korean prose, dark theme, IBM Plex Sans KR / IBM Plex Mono, accent `#55e6a5`.
Index and chapter pages link `assets/sim.css` and use its `.card`, `.card
empty`, `.cat`, `.crumb`, `.eyebrow`, `.lede` classes — don't inline a fresh
copy of the CSS. Individual simulations keep their own styling.

Card descriptions say what the reader will *see or do*, not what the topic is
called. One or two sentences.

## Verifying before you push

Start the preview server (`.claude/launch.json` has a `lab-site` entry serving
the repo root on 8742) and actually open the page — these are interactive
pages, and a screenshot is the only thing that catches a silent render failure.
Check `read_console_messages` and `read_network_requests` too.

Link check across the whole area:

```bash
cd simulations
for f in $(find . -name '*.html'); do d=$(dirname "$f")
  for h in $(grep -o 'href="[^"#]*"' "$f" | sed 's/href="//;s/"//'); do
    case "$h" in http*|mailto*) continue;; esac
    t="$d/$h"; [ -d "$t" ] && t="$t/index.html"
    [ -e "$t" ] || echo "BROKEN: $f -> $h"
  done
done
```

After pushing, confirm the deploy landed with `curl` rather than a browser:

```bash
curl -s https://bsohn.net/simulations/vacuum/ | grep -o '<a class="[^"]*" href="ch[0-9]/">'
```

## Gotchas already paid for

- **Never name a page-level class `.plot-container`** if the page uses Plotly.
  Plotly gives its own internal wrapper that class, so a page rule like
  `overflow: hidden` clips Plotly's absolutely-positioned SVG and the chart
  renders blank with no error. Use `.plot-card` or anything else.
- **Give Plotly graph divs an explicit CSS height.** With `responsive: true`
  and no height they collapse to 0 on the first re-render — the initial draw
  can look fine because a placeholder was propping the container open.
- `Plotly.react` does **not** clear pre-existing children of the graph div, so
  a `<div class="loading">` placeholder survives behind the chart. Remove it
  explicitly.
- Git warns `LF will be replaced by CRLF` on every write here. Harmless.

## Related repos

`C:\Users\user\Desktop\Study_01` — scratch repo where simulations are often
drafted before being copied in. Its copy and the site copy drift; when fixing a
simulation, patch the source there and re-copy rather than editing only the
published file.
