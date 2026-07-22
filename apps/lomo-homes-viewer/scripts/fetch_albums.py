#!/usr/bin/env python3
"""Fetch albums from a Lomography user's profile."""

import argparse
import json
import re
import sys

from lomography_client import (
    LomographyClient,
    LomographyClientError,
    LomographyRateLimitError,
)

ALBUM_LINK_PATTERN = re.compile(
    r"<h3[^>]*>.*?"
    r'<a[^>]*href="(/homes/[^"]+?/albums/(\d+(?:-[\w-]*)?))(?:[?#][^"]*)?"[^>]*>'
    r"([^<]+)</a>.*?</h3>",
    re.DOTALL | re.IGNORECASE,
)

ALBUM_LINK_FALLBACK_PATTERN = re.compile(
    r'<a[^>]*href="(/homes/[^"]+?/albums/(\d+(?:-[\w-]*)?))(?:[?#][^"]*)?"[^>]*>([^<]+)</a>',
    re.DOTALL,
)

COVER_IMAGE_PATTERN = re.compile(
    r"<figure[^>]*>.*?"
    r'<img[^>]*src="(https://cdn\.assets\.lomography\.com[^"]*)"'
    r".*?</figure>",
    re.DOTALL | re.IGNORECASE,
)

CDN_IMAGE_PATTERN = re.compile(
    r'<img[^>]*src="(https://cdn\.assets\.lomography\.com[^"]*)"',
    re.DOTALL,
)


def extract_albums(html: str) -> list[dict]:
    """Extract album metadata from a rendered albums page."""
    seen: set[str] = set()
    albums: list[dict] = []

    matches = ALBUM_LINK_PATTERN.findall(html)
    if not matches:
        matches = ALBUM_LINK_FALLBACK_PATTERN.findall(html)

    for album_path, album_id, title in matches:
        if album_id not in seen:
            seen.add(album_id)
            albums.append(
                {
                    "albumId": album_id,
                    "albumPage": album_path,
                    "coverImage": "",
                    "title": title.strip() or f"Album {album_id}",
                }
            )

    cover_images = COVER_IMAGE_PATTERN.findall(html) or CDN_IMAGE_PATTERN.findall(html)
    for index, album in enumerate(albums):
        if index < len(cover_images):
            album["coverImage"] = cover_images[index]

    return albums


def fetch_all_albums(username: str) -> dict:
    url = f"https://www.lomography.com/homes/{username}/albums"
    try:
        with LomographyClient() as client:
            albums = extract_albums(client.get(url))
    except LomographyRateLimitError as exc:
        print(f"  Albums: {exc}", file=sys.stderr)
        return _result(username, [], rate_limited=True)
    except LomographyClientError as exc:
        print(f"  Albums: {exc}", file=sys.stderr)
        return _result(username, [], error=str(exc))

    return _result(username, albums)


def _result(
    username: str,
    albums: list[dict],
    *,
    rate_limited: bool = False,
    error: str | None = None,
) -> dict:
    return {
        "username": username,
        "albumCount": len(albums),
        "albums": albums,
        "rateLimited": rate_limited,
        "error": error,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch Lomography albums")
    parser.add_argument("username", help="Lomography username")
    args = parser.parse_args()
    print(json.dumps(fetch_all_albums(args.username)))


if __name__ == "__main__":
    main()
