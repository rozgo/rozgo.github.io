#!/usr/bin/env python3
"""Validate the static portfolio's local links and YouTube embeds."""

from __future__ import annotations

import argparse
import html.parser
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML_FILE = ROOT / "index.html"


class IndexParser(html.parser.HTMLParser):
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

        for attr in ("href", "src", "content"):
            if attr not in data:
                continue
            if tag == "meta" and attr == "content":
                prop = data.get("property", "")
                if prop not in {"og:image", "twitter:image"}:
                    continue
            self.refs.append((line, tag, attr, data[attr]))


def parse_index() -> IndexParser:
    parser = IndexParser()
    parser.feed(HTML_FILE.read_text(encoding="utf-8"))
    return parser


def local_path_exists(raw: str) -> bool:
    path, _ = urllib.parse.urldefrag(raw)
    path = path.split("?", 1)[0]
    if not path:
        return True
    target = (ROOT / urllib.parse.unquote(path)).resolve()
    try:
        target.relative_to(ROOT)
    except ValueError:
        return False
    return target.exists()


def check_local_refs(parser: IndexParser) -> list[str]:
    errors: list[str] = []

    for line, _tag, _attr, value in parser.refs:
        if not value or value.startswith(("mailto:", "tel:", "javascript:", "data:")):
            continue
        parsed = urllib.parse.urlparse(value)
        if parsed.scheme in {"http", "https"}:
            continue
        if value.startswith("#"):
            anchor = value[1:]
            if anchor and anchor not in parser.ids:
                errors.append(f"line {line}: missing anchor target {value}")
            continue
        if not local_path_exists(value):
            errors.append(f"line {line}: missing local file {value}")

    return errors


def check_images(parser: IndexParser) -> list[str]:
    errors: list[str] = []
    required = {"src", "alt", "width", "height", "loading", "decoding"}

    for line, src, attrs in parser.images:
        missing = sorted(required - attrs.keys())
        if missing:
            errors.append(f"line {line}: image {src} missing {', '.join(missing)}")

    return errors


def check_blank_links(parser: IndexParser) -> list[str]:
    errors: list[str] = []

    for line, href, rel in parser.blank_links:
        if "noopener" not in rel.split():
            errors.append(f"line {line}: target=_blank link missing rel=noopener: {href}")

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


def check_youtube(parser: IndexParser) -> list[str]:
    errors: list[str] = []
    seen: set[str] = set()

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
                    errors.append(f"line {line}: YouTube returned {response.status} for {value}")
        except Exception as exc:  # noqa: BLE001 - command-line validator should report every failure.
            errors.append(f"line {line}: YouTube unavailable for {value}: {exc}")

    return errors


def main() -> int:
    arg_parser = argparse.ArgumentParser()
    arg_parser.add_argument("--youtube", action="store_true", help="also verify YouTube videos with oEmbed")
    args = arg_parser.parse_args()

    parser = parse_index()
    errors = []
    errors.extend(check_local_refs(parser))
    errors.extend(check_images(parser))
    errors.extend(check_blank_links(parser))
    errors.extend(check_css_urls())
    errors.extend(check_stale_domains())
    if args.youtube:
        errors.extend(check_youtube(parser))

    if errors:
        print("Link check failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print("Link check passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
