# OceanGate Limited eProject

The final website uses **black and exact cyan `#04d9ff`**. It contains **132 educational products, 8 brands, 9 storage families, 14 compatible comparison types, 160 HTML pages and 132 individual Word specifications**. The website, source, tools, documentation and delivery archive all live inside this `OceanGate` folder. This is a local project; nothing has been published.

The user’s final selection supersedes the original request for two design alternatives. The other colour editions and their archives have been removed. The original brief and master prompt remain under `documentation/source-brief/` as historical requirements inputs.

## Open the website

Run `Start-Preview.ps1` from this folder in PowerShell. It starts a loopback-only static server and prints the address. Keep that terminal open; Ctrl+C stops it. Alternatively, with Python 3 installed, run from inside `OceanGate`:

```powershell
python -m http.server 8080 --bind 127.0.0.1
```

Open `http://127.0.0.1:8080/`. If the parent workspace is already being served on port 8080, use `http://127.0.0.1:8080/OceanGate/` instead. Use a static HTTP server because `file://` can block the XML fetch. A local static server is not an application backend.

The final design keeps the asymmetric hero, technical grid, crisp cards and desktop catalogue sidebar. Finite entrance and artwork animations, scroll reveals and subtle hover feedback add movement. Reduced-motion preferences disable the effects; content remains readable without JavaScript or animation.

## Folder contents

| Location | Purpose |
|---|---|
| HTML files, `products/`, `categories/`, `brands/` | Complete runnable website and all detail/collection pages |
| `assets/`, `data/`, `downloads/` | Local styling/scripts, brand and product artwork, XML/XSD and 132 Word specifications |
| `source/` | Maintained source assets and authoritative XML used for regeneration |
| `tools/` | Development generators and validation helpers |
| `documentation/` | Editable report, original brief evidence, technical notes and final QA evidence |
| `deliverables/OceanGate.zip` | Packaged independently runnable final website |

## Demonstration rules

Models, prices, configurations, reviews and location listings are labelled educational samples. Brand names are illustrative historic catalogue groupings; no affiliation is claimed. No order, payment, account or message is stored. Cart state uses memory plus validated `cart=OG-001:2,OG-002:1` URL parameters; comparison uses `compare=OG-001,OG-002`. Quantities are integers from 1 to 99. The bag badge counts total item quantity. Refreshing a state-bearing URL restores it; a new clean URL starts empty. Contact opens an email draft for the visitor to review and send in their own mail application.

## Maintain and regenerate

The authoritative dataset is `source/data/oceangate.xml`. Edit this file rather than the generated copy in `data/`. The maintained CSS and JavaScript are under `source/assets/`. Validate and regenerate after edits so the website, static product pages and Word downloads stay synchronized. Generated HTML and JSON-LD are derived output, not a second maintained catalogue.

Development uses Python 3 with `lxml`, `python-docx` and Pillow, plus Node with Sharp and Playwright. Browsing the completed website needs none of those development packages. Run commands from this `OceanGate` folder:

```powershell
python tools/build_catalogue.py
node tools/export_brand.cjs
node tools/build_visuals.cjs
python tools/build_specs.py
python tools/build_sites.py
python tools/validate.py
node tools/test_runtime.cjs
node tools/test_browser.cjs
```

`build_catalogue.py` creates seed XML only if it is absent; existing maintained records are preserved. The Word generator consumes XML. `build_sites.py` validates XSD and writes the final website directly into this folder; an explicit output directory is optional. It no longer produces alternate colour editions. After changes to Bootstrap-dependent UI, regenerate the used-rule stylesheet with `tools/build_bootstrap_subset.cjs` and rebuild the website. The complete original Bootstrap stylesheet and MIT licence remain included.

`tools/audit.cjs` uses development-only Lighthouse and axe packages. `tools/build_documentation.py` generates the editable report after current screenshots and QA results are available. `tools/package.py` prepares the final runnable archive. The JavaScript helpers use the available Codex bundled dependencies; on another workstation, install equivalent packages and adjust helper imports if necessary. No machine-specific paths are required by the browser website.

## Configuration for this local project

Company address, email, telephone, map coordinates and service/distributor listings are clear placeholders. They can be edited under `oceanGate/config`, `supportCentres` and `distributors` in the authoritative XML, then regenerated. Latitude and longitude zero are valid; blank or invalid coordinates produce a deliberate placeholder without a misleading map or directions link.

Keep `seoMode` as `preview` for this educational project. Every page begins with `noindex, follow`. `sitemap.template.xml` uses reserved example.com and is not for submission. No domain, hosting account, API key or Search Console account is required. `documentation/launch-checklist.md` records optional future hosting work only; it is not a requirement to review or submit this project.

## Documentation

- `documentation/OceanGate-Project-Report.docx`: editable project report and unsigned completion certificate template.
- `documentation/requirements-matrix.md`: requirement coverage including the final user-selected scope.
- `documentation/architecture.md`: XML relationships, algorithms and interface standards.
- `documentation/seo-audit.md`, `keyword-map.md`, `launch-checklist.md`: implementation notes and optional future hosting checklist.
- `documentation/validation-summary.md` and `documentation/qa/`: current measured checks and visual evidence, including verification limits.
- `documentation/source-brief/`: full legacy DOC extraction and all three embedded reference images.
- `documentation/brand-notes.md`, `catalogue-assumptions.md`: original asset guidance and sample-data assumptions.

Unzip `deliverables/OceanGate.zip`, enter its `OceanGate` folder and use its start instructions to review the packaged website independently.
