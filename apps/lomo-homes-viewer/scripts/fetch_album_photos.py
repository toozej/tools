#!/usr/bin/env python3
"""Fetch photos from a specific Lomography album."""

import argparse
import json
import re
import sys

from lomography_client import (
    LomographyClient,
    LomographyClientError,
    LomographyRateLimitError,
)

MAX_EMPTY_PAGES = 3

PHOTO_LINK_PATTERN = re.compile(
    r'<a[^>]*href="(/homes/[^"]+?/albums/\d+[^/]*/\d+)"[^>]*>'
    r"(?:[^<]|<(?!/a>))*?"
    r'<img[^>]*src="(https://cdn\.assets\.lomography\.com[^"]*)"'
    r"(?:[^<]|<(?!/a>))*?</a>",
    re.DOTALL,
)


def extract_photos(html: str) -> list[dict]:
    """Extract unique thumbnail and album-photo page pairs."""
    seen: set[str] = set()
    pairs: list[dict] = []
    for page_link, thumb_url in PHOTO_LINK_PATTERN.findall(html):
        if thumb_url not in seen:
            seen.add(thumb_url)
            pairs.append({"thumbnail": thumb_url, "photoPage": page_link})
    return pairs


def fetch_all_pages(
    username: str,
    album_id: str,
    start_page: int,
    end_page: int,
) -> dict:
    all_images: list[dict] = []
    seen: set[str] = set()
    last_page_reached = start_page - 1
    empty_pages = 0
    has_found_images = False

    try:
        with LomographyClient() as client:
            for page in range(start_page, end_page + 1):
                url = f"https://www.lomography.com/homes/{username}/albums/{album_id}?page={page}"
                pairs = extract_photos(client.get(url))

                if not pairs:
                    if has_found_images:
                        print(f"Reached end of album at page {page}.", file=sys.stderr)
                        break
                    empty_pages += 1
                    print(
                        f"  Album page {page}: no images "
                        f"({empty_pages}/{MAX_EMPTY_PAGES} empty pages)",
                        file=sys.stderr,
                    )
                    if empty_pages >= MAX_EMPTY_PAGES:
                        break
                    continue

                empty_pages = 0
                has_found_images = True
                last_page_reached = page
                for pair in pairs:
                    thumbnail = pair["thumbnail"]
                    if thumbnail not in seen:
                        seen.add(thumbnail)
                        all_images.append(pair)

    except LomographyRateLimitError as exc:
        print(f"  Album photos: {exc}", file=sys.stderr)
        return _result(
            username,
            album_id,
            all_images,
            last_page_reached,
            start_page,
            rate_limited=True,
        )
    except LomographyClientError as exc:
        print(f"  Album photos: {exc}", file=sys.stderr)
        return _result(
            username,
            album_id,
            all_images,
            last_page_reached,
            start_page,
            error=str(exc),
        )

    return _result(username, album_id, all_images, last_page_reached, start_page)


def _result(
    username: str,
    album_id: str,
    images: list[dict],
    last_page_reached: int,
    start_page: int,
    *,
    rate_limited: bool = False,
    error: str | None = None,
) -> dict:
    return {
        "username": username,
        "albumId": album_id,
        "imageCount": len(images),
        "images": images,
        "pagesScanned": max(last_page_reached - start_page + 1, 0),
        "rateLimited": rate_limited,
        "error": error,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch photos from a Lomography album")
    parser.add_argument("username", help="Lomography username")
    parser.add_argument("album_id", help="Album ID (with optional slug)")
    parser.add_argument("start_page", type=int, help="Start page number")
    parser.add_argument("end_page", type=int, nargs="?", help="End page number (optional)")
    args = parser.parse_args()

    end_page = args.end_page if args.end_page else args.start_page
    print(json.dumps(fetch_all_pages(args.username, args.album_id, args.start_page, end_page)))


if __name__ == "__main__":
    main()
