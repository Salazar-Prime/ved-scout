# Experiment fieldbook publishing

The GitHub Pages site is a dependency-free static build in `docs/`. It does not
use the repository's Next.js runtime.

## Refresh the data

The source workbooks live under `000_manual-testing/`. The imported KML files
and the public workbook copies live in `docs/assets/source/` so visitors can
download the inputs. After changing either workbook, run:

```bash
npm run build:experiment-site
```

To import replacement KML files from another location, pass explicit paths:

```bash
node scripts/build-experiment-site-data.mjs \
  --easy-kml "path/to/easy-plot.kml" \
  --hard-kml "path/to/hard-plot.kml"
```

This regenerates `docs/assets/experiment-data.js` and updates the downloadable
source copies. Review the generated diff before committing it.

## Preview

From the repository root, run:

```bash
python3 -m http.server 4173 --directory docs
```

Then open <http://localhost:4173/>. Check the Easy and Hard plot controls, both
“Browse first by” modes, question search and filters, and ASR filters at desktop
and mobile widths.

## Publish

The `Deploy experiment fieldbook to GitHub Pages` workflow deploys `docs/` after
changes reach `main`. The repository owner must select **GitHub Actions** as the
Pages source in **Settings → Pages** once. The expected project-site URL is:

<https://salazar-prime.github.io/ved-scout/>

Do not describe the site as public until the Pages deployment succeeds and that
URL loads without authentication.
