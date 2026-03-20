#!/usr/bin/env python3
"""Fetch a single Lomography photo detail page and extract the largest image URL.

Usage:
    fetch_photo_detail.py <photo_path>

Example:
    fetch_photo_detail.py /homes/aciano/photos/29205949

Outputs JSON: {"fullsize": "https://cdn.assets.lomography.com/.../1216x1812x1.jpg?auth=..."}
              or {"fullsize": null} if extraction fails.
"""

import json
import re
import sys
import urllib.error
import urllib.request

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Connection": "keep-alive",
}

IMG_PATTERN = re.compile(r'https://cdn\.assets\.lomography\.com/[^\s"<>\']+\.\w+(?:\?[^\s"<>\']*)?')


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: fetch_photo_detail.py <photo_path>", file=sys.stderr)
        sys.exit(1)

    photo_path = sys.argv[1]
    url = f"https://www.lomography.com{photo_path}"

    try:
        req = urllib.request.Request(url, headers=HEADERS)
        resp = urllib.request.urlopen(req, timeout=15)
        html = resp.read().decode()

        # Find the largest image by pixel count
        best_url = None
        best_pixels = 0

        for img_url in IMG_PATTERN.findall(html):
            m = re.search(r"/(\d+)x(\d+)x\d+\.", img_url)
            if m:
                pixels = int(m.group(1)) * int(m.group(2))
                if pixels > best_pixels:
                    best_pixels = pixels
                    best_url = img_url

        if best_url:
            print(json.dumps({"fullsize": best_url}))
        else:
            print(
                f"  Detail {photo_path}: no image URL found on page",
                file=sys.stderr,
            )
            sys.exit(1)

    except (urllib.error.URLError, urllib.error.HTTPError) as exc:
        print(f"  Detail {photo_path}: {exc}", file=sys.stderr)
        sys.exit(1)
    except Exception as exc:
        print(f"  Detail {photo_path}: {type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
