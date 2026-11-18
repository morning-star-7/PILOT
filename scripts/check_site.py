#!/usr/bin/env python3
"""Validate the anonymous website and its assets."""

from html.parser import HTMLParser
from os.path import normpath
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]
CSS_URL = re.compile(r'''url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)''', re.IGNORECASE)


class SiteParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.references = []
        self.images = []
        self.h1_count = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        if tag == "h1":
            self.h1_count += 1
        if tag == "meta" and attrs.get("property") == "og:image" and attrs.get("content"):
            self.references.append(attrs["content"])
        for attribute in ("href", "src", "poster"):
            if attrs.get(attribute):
                self.references.append(attrs[attribute])
        if tag == "img" and attrs.get("src"):
            self.images.append(attrs)


def referenced_assets(parser, errors):
    """Collect the files requested by the page and its stylesheets."""
    assets_dir = ROOT / "assets"
    pending = [(ROOT, reference) for reference in parser.references]
    assets = set()
    while pending:
        base, reference = pending.pop()
        url = urlsplit(reference)
        if url.scheme or url.netloc or not url.path:
            continue

        asset = Path(normpath(base / unquote(url.path)))
        if asset in assets or asset == ROOT / "index.html":
            continue
        if assets_dir not in asset.parents or assets_dir not in asset.resolve().parents:
            errors.append(f"Asset outside assets/: {reference}")
            continue
        if not asset.is_file():
            errors.append(f"Missing asset: {reference}")
            continue

        assets.add(asset)
        if asset.suffix.lower() == ".css":
            for quoted, single_quoted, unquoted in CSS_URL.findall(asset.read_text(encoding="utf-8")):
                pending.append((asset.parent, quoted or single_quoted or unquoted))
    return assets


def main():
    parser = SiteParser()
    parser.feed((ROOT / "index.html").read_text(encoding="utf-8"))
    errors = []
    if parser.h1_count != 1:
        errors.append(f"Expected one h1, found {parser.h1_count}")
    duplicate_ids = {item for item in parser.ids if parser.ids.count(item) > 1}
    if duplicate_ids:
        errors.append(f"Duplicate IDs: {sorted(duplicate_ids)}")

    assets = referenced_assets(parser, errors)
    for reference in parser.references:
        url = urlsplit(reference)
        if not (url.scheme or url.netloc or url.path) and url.fragment and url.fragment not in parser.ids:
            errors.append(f"Missing anchor: {reference}")

    # Pillow is optional; the core validator uses only the Python standard library.
    try:
        from PIL import Image
    except ImportError:
        Image = None
        print("INFO: Pillow unavailable; skipping pixel-dimension validation.")
    for attrs in parser.images:
        if not attrs.get("alt"):
            errors.append(f"Missing image description: {attrs['src']}")
        asset = Path(normpath(ROOT / unquote(urlsplit(attrs["src"]).path)))
        if asset not in assets:
            continue
        declared = (int(attrs.get("width", 0)), int(attrs.get("height", 0)))
        if asset.suffix.lower() == ".svg":
            svg = ElementTree.parse(asset).getroot()
            if svg.tag != "{http://www.w3.org/2000/svg}svg":
                errors.append(f"Invalid SVG root: {asset.name}")
                continue
            view_box = [float(value) for value in svg.attrib["viewBox"].split()]
            if len(view_box) != 4 or declared != tuple(view_box[2:]):
                errors.append(
                    f"Incorrect SVG dimensions for {asset.name}: {declared} vs {view_box}"
                )
        elif Image is not None:
            with Image.open(asset) as image:
                expected_format = Image.registered_extensions().get(asset.suffix.lower())
                if expected_format and image.format != expected_format:
                    errors.append(f"Unexpected image format for {asset.name}: {image.format}")
                image.verify()
                if declared != image.size:
                    errors.append(
                        f"Incorrect image dimensions for {asset.name}: {declared} vs {image.size}"
                    )

    if errors:
        for error in errors:
            print(f"FAIL: {error}")
        raise SystemExit(1)
    print(
        f"PASS: {len(assets)} local assets, {len(parser.images)} images, and anchors checked."
    )


if __name__ == "__main__":
    main()
