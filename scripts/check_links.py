#!/usr/bin/env python3
"""Validate the static site's local links, anchors, image attributes and YouTube videos."""

from __future__ import annotations

import argparse
import html.parser
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SITE = "https://rozgo.github.io/"
REF_ATTRS = ("href", "src", "poster", "content", "data-src", "data-poster", "data-preview", "data-href")


class PageParser(html.parser.HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: set[str] = set()
        self.refs: list[tuple[int, str, str, str]] = []
        self.images: list[tuple[int, str, dict[str, str]]] = []
        self.blank_links: list[tuple[int, str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = {name: value or "" for name, value in attrs}
        line = self.getpos()[0]

        if "id" in data:
            self.ids.add(data["id"])

        if tag == "img":
            self.images.append((line, data.get("src", ""), data))

        if tag == "a" and data.get("target") == "_blank":
            self.blank_links.append((line, data.get("href", ""), data.get("rel", "")))

        for attr in REF_ATTRS:
            if attr not in data:
                continue
            if tag == "meta" and attr == "content":
                prop = data.get("property", "") or data.get("name", "")
                if prop not in {"og:image", "twitter:image"}:
                    continue
            self.refs.append((line, tag, attr, data[attr]))


def html_files() -> list[Path]:
    return sorted(p for p in ROOT.rglob("*.html") if ".git" not in p.parts)


def parse(path: Path) -> PageParser:
    parser = PageParser()
    parser.feed(path.read_text(encoding="utf-8"))
    return parser


def resolve(page: Path, raw: str) -> tuple[Path | None, str]:
    """Return the local file a reference points to (or None if it leaves the repository) and its fragment."""
    if raw.startswith(SITE):
        raw = "/" + raw[len(SITE):]
    path, fragment = urllib.parse.urldefrag(raw)
    path = path.split("?", 1)[0]
    if not path:
        return page, fragment
    base = ROOT if path.startswith("/") else page.parent
    target = (base / urllib.parse.unquote(path.lstrip("/"))).resolve()
    try:
        target.relative_to(ROOT)
    except ValueError:
        return None, fragment
    if target.is_dir():
        target = target / "index.html"
    return target, fragment


def check_local_refs(pages: dict[Path, PageParser]) -> list[str]:
    errors: list[str] = []

    for page, parser in pages.items():
        name = page.relative_to(ROOT)
        for line, tag, _attr, value in parser.refs:
            if not value or value.startswith(("mailto:", "tel:", "javascript:", "data:")):
                continue
            parsed = urllib.parse.urlparse(value)
            # Absolute site URLs are checked only in meta and link tags: other project
            # sites (for example /alienwars-gym/) share the domain but live in other repositories.
            if parsed.scheme in {"http", "https"} and not (value.startswith(SITE) and tag in {"meta", "link"}):
                continue
            target, fragment = resolve(page, value)
            if target is None:
                errors.append(f"{name}:{line}: reference leaves repository: {value}")
                continue
            if not target.exists():
                errors.append(f"{name}:{line}: missing local file {value}")
                continue
            if fragment and target.suffix == ".html":
                ids = pages[target].ids if target in pages else parse(target).ids
                if fragment not in ids:
                    errors.append(f"{name}:{line}: missing anchor target {value}")

    return errors


def check_images(pages: dict[Path, PageParser]) -> list[str]:
    errors: list[str] = []
    required = {"src", "alt", "width", "height", "loading", "decoding"}

    for page, parser in pages.items():
        for line, src, attrs in parser.images:
            missing = sorted(required - attrs.keys())
            if missing:
                errors.append(f"{page.relative_to(ROOT)}:{line}: image {src} missing {', '.join(missing)}")

    return errors


def check_blank_links(pages: dict[Path, PageParser]) -> list[str]:
    errors: list[str] = []

    for page, parser in pages.items():
        for line, href, rel in parser.blank_links:
            if "noopener" not in rel.split():
                errors.append(f"{page.relative_to(ROOT)}:{line}: target=_blank link missing rel=noopener: {href}")

    return errors


def check_css_urls() -> list[str]:
    errors: list[str] = []
    url_pattern = re.compile(r"url\(([^)]+)\)")

    for path in (ROOT / "css").glob("*.css"):
        css = path.read_text(encoding="utf-8")
        css = re.sub(r"/\*.*?\*/", "", css, flags=re.DOTALL)

        for match in url_pattern.finditer(css):
            raw = match.group(1).strip().strip("\"'")
            if not raw or raw.startswith(("#", "data:", "http://", "https://")):
                continue

            asset = raw.split("?", 1)[0].split("#", 1)[0]
            target = (path.parent / urllib.parse.unquote(asset)).resolve()
            try:
                target.relative_to(ROOT)
            except ValueError:
                errors.append(f"{path.relative_to(ROOT)}: CSS URL leaves repository: {raw}")
                continue
            if not target.exists():
                errors.append(f"{path.relative_to(ROOT)}: missing CSS asset {raw}")

    return errors


def check_stale_domains() -> list[str]:
    errors: list[str] = []
    old_brand = "vertex" + "studio"
    pattern = re.compile(rf"{old_brand}(?:\.co)?", re.IGNORECASE)

    for path in ROOT.rglob("*"):
        if ".git" in path.parts or "__pycache__" in path.parts or not path.is_file():
            continue
        try:
            data = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            data = path.read_bytes().decode("latin-1", errors="ignore")
        if pattern.search(data):
            errors.append(f"{path.relative_to(ROOT)}: contains stale old-domain reference")

    return errors


def youtube_id(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    host = parsed.hostname or ""
    if host.endswith("youtu.be"):
        return parsed.path.strip("/")
    if "youtube.com" in host:
        return urllib.parse.parse_qs(parsed.query).get("v", [""])[0]
    return ""


def check_youtube(pages: dict[Path, PageParser]) -> list[str]:
    errors: list[str] = []
    seen: set[str] = set()

    for page, parser in pages.items():
        for line, tag, attr, value in parser.refs:
            if tag != "a" or attr != "href":
                continue
            video_id = youtube_id(value)
            if not video_id or video_id in seen:
                continue
            seen.add(video_id)
            endpoint = "https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(value, safe="")
            request = urllib.request.Request(endpoint, headers={"User-Agent": "Mozilla/5.0"})
            try:
                with urllib.request.urlopen(request, timeout=15) as response:
                    if response.status >= 400:
                        errors.append(f"{page.relative_to(ROOT)}:{line}: YouTube returned {response.status} for {value}")
            except Exception as exc:  # noqa: BLE001 - command-line validator should report every failure.
                errors.append(f"{page.relative_to(ROOT)}:{line}: YouTube unavailable for {value}: {exc}")

    return errors


def main() -> int:
    arg_parser = argparse.ArgumentParser()
    arg_parser.add_argument("--youtube", action="store_true", help="also verify YouTube videos with oEmbed")
    args = arg_parser.parse_args()

    pages = {path.resolve(): parse(path) for path in html_files()}
    errors = []
    errors.extend(check_local_refs(pages))
    errors.extend(check_images(pages))
    errors.extend(check_blank_links(pages))
    errors.extend(check_css_urls())
    errors.extend(check_stale_domains())
    if args.youtube:
        errors.extend(check_youtube(pages))

    if errors:
        print("Link check failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(f"Link check passed ({len(pages)} pages)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
