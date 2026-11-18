# PILOT

Anonymous supplementary website for the PILOT paper, with the method, four real-world task demonstrations, and experimental results.

## Preview and export

Run these commands from the repository root.

```bash
python3 scripts/check_site.py
python3 scripts/export_site.py
python3 -m http.server 8000 --bind 127.0.0.1 --directory build/site
```

Open <http://localhost:8000> or `build/site/index.html`. The export also creates `build/pilot-website.zip`. Use `build/site/` as the web root when hosting the review page.

## Project files

- `index.html` contains the page and the poster and video URLs for each demonstration.
- `assets/` contains the page styles, interactions, figures, videos, fonts, and font license.
- `scripts/` contains the validation and export commands. The validator uses Pillow for raster image checks when it is installed.
