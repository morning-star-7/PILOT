#!/usr/bin/env python3
"""Export the anonymous site and its referenced assets."""

from pathlib import Path
import shutil
from tempfile import TemporaryDirectory
from zipfile import ZipFile, ZIP_DEFLATED

from check_site import ROOT, SiteParser, referenced_assets


def main():
    index = ROOT / "index.html"
    parser = SiteParser()
    parser.feed(index.read_text(encoding="utf-8"))
    errors = []
    files = referenced_assets(parser, errors)
    if errors:
        raise SystemExit("\n".join(errors))
    files.update([index, ROOT / ".nojekyll", ROOT / "assets/fonts/NotoSans-OFL.txt"])

    build = ROOT / "build"
    output = build / "site"
    archive = build / "pilot-website.zip"
    build.mkdir(exist_ok=True)
    with TemporaryDirectory(prefix=".site-export-", dir=build) as directory:
        staged_site = Path(directory) / output.name
        staged_archive = Path(directory) / archive.name
        with ZipFile(staged_archive, "w", ZIP_DEFLATED) as bundle:
            for file in sorted(files):
                relative = file.relative_to(ROOT)
                target = staged_site / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(file, target)
                bundle.write(target, str(relative))

        if output.exists():
            shutil.rmtree(output)
        staged_site.rename(output)
        staged_archive.replace(archive)
    print(f"Exported {len(files)} files to {output}")
    print(f"Created {archive} ({archive.stat().st_size / 1024 / 1024:.1f} MB)")


if __name__ == "__main__":
    main()
