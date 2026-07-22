#!/usr/bin/env python3
"""Fetch a Lomography photo detail page and extract its largest image URL."""

import json
import re
import sys

from lomography_client import LomographyClient, LomographyClientError

IMG_PATTERN = re.compile(
    r'https://cdn\.assets\.lomography\.com/[^\s"<>\']+\.\w+(?:\?[^\s"<>\']*)?'
)


def extract_fullsize(html: str) -> str | None:
    """Select the CDN URL with the largest dimensions encoded in its path."""
    best_url = None
    best_pixels = 0

    for image_url in IMG_PATTERN.findall(html):
        dimensions = re.search(r"/(\d+)x(\d+)x\d+\.", image_url)
        if dimensions:
            pixels = int(dimensions.group(1)) * int(dimensions.group(2))
            if pixels > best_pixels:
                best_pixels = pixels
                best_url = image_url

    return best_url


def fetch_photo_detail(photo_path: str) -> dict:
    url = f"https://www.lomography.com{photo_path}"
    try:
        with LomographyClient() as client:
            fullsize = extract_fullsize(client.get(url))
    except LomographyClientError as exc:
        print(f"  Detail {photo_path}: {exc}", file=sys.stderr)
        return {"fullsize": None, "error": str(exc)}

    if not fullsize:
        message = "No image URL found on photo page"
        print(f"  Detail {photo_path}: {message}", file=sys.stderr)
        return {"fullsize": None, "error": message}

    return {"fullsize": fullsize, "error": None}


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: fetch_photo_detail.py <photo_path>", file=sys.stderr)
        sys.exit(1)

    print(json.dumps(fetch_photo_detail(sys.argv[1])))


if __name__ == "__main__":
    main()
