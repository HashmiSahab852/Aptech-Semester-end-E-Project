# OceanGate manufacturer logo assets

Prepared 2026-10-27. These are existing vector logo artworks, not AI-generated logos. All eight files have been parsed and rasterized with Sharp; see `logo-preview.png` for the checked contact sheet. They contain no scripts, foreignObject elements, or external image dependencies. Total SVG payload is approximately 42 KB.

## Integration

Copy only the eight `*.svg` logo files into the site's existing `assets/brand/` directory with names `brand-imation.svg`, `brand-sony.svg`, etc. Keep the original folder hierarchy. Mirror into `source/assets/brand/` if maintaining the source asset copies.

- Home: `index.html` has plain brand name links in `.brand-band > .brand-row`, currently around lines 286-297. Replace the link contents with the appropriate `<img>` and retain each existing brand catalogue href. Use meaningful alt text such as `Sony`.
- Brand catalogue headers: `brands/brand-*.html` each have a `.page-intro` header. A logo image above its existing h1 improves brand identity without replacing the accessible title. Use `../assets/brand/brand-sony.svg`, etc.
- Other prose and product spec labels can stay as text; manufacturer branding is most useful in brand showcases and brand page headers.
- No JavaScript renders/replaces the home brand strip. `assets/js/pages/index.js` currently just invokes `app.start()`.
- Display the original colours on white or very light backgrounds. Suggested strip tiles: 140px wide, 64px high; images no more than 108px wide and 30px high with `object-fit: contain`. Give HP a square box (36x36) instead of stretching it like a wordmark. Avoid blanket filters that obscure original brand colours.

## Source mapping

| Catalogue id | Local file | Source page | Downloaded asset |
|---|---|---|---|
| imation | imation.svg | https://worldvectorlogo.com/logo/imation-logo-1 | https://cdn.worldvectorlogo.com/logos/imation-logo-1.svg |
| sony | sony.svg | https://commons.wikimedia.org/wiki/File:Sony_logo.svg | https://upload.wikimedia.org/wikipedia/commons/c/ca/Sony_logo.svg |
| verbatim | verbatim.svg | https://commons.wikimedia.org/wiki/File:Verbatim_logo_(2024-present).svg | https://upload.wikimedia.org/wikipedia/commons/c/cf/Verbatim_logo_%282024-present%29.svg |
| tdk | tdk.svg | https://commons.wikimedia.org/wiki/File:TDK_wordmark.svg | https://upload.wikimedia.org/wikipedia/commons/3/30/TDK_wordmark.svg |
| maxell | maxell.svg | https://commons.wikimedia.org/wiki/File:Maxell_logo.svg | https://upload.wikimedia.org/wikipedia/commons/a/ab/Maxell_logo.svg |
| samsung | samsung.svg | https://commons.wikimedia.org/wiki/File:Samsung_wordmark.svg | https://upload.wikimedia.org/wikipedia/commons/b/b4/Samsung_wordmark.svg |
| hp | hp.svg | https://commons.wikimedia.org/wiki/File:HP_logo_2012.svg | https://upload.wikimedia.org/wikipedia/commons/a/ad/HP_logo_2012.svg |
| quantum | quantum.svg | https://commons.wikimedia.org/wiki/File:Quantum_Corporation_logo.svg | https://upload.wikimedia.org/wikipedia/commons/6/63/Quantum_Corporation_logo.svg |

Logos identify the manufacturers represented in this educational catalogue. The source pages label the Wikimedia wordmarks as public-domain textlogos; manufacturer trademarks remain owned by their respective companies. No partnership/authorization claim should be added.
