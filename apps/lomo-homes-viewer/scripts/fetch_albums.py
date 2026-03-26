#!/usr/bin/env python3
"""Fetch albums from a Lomography user's profile using async requests.

Usage:
    fetch_albums.py <username>
    fetch_albums.py <username> --quick

Features:
    - Async fetching with aiohttp (bypasses Cloudflare)
    - Exponential backoff with jitter on failures
    - Extracts album links, titles, and cover images
    - --quick flag: exit early on rate limiting (retries=1, faster failure)
"""

import argparse
import asyncio
import json
import random
import re
import sys

import aiohttp

REQUEST_DELAY = 0.5
MAX_RETRIES = 7
BACKOFF_BASE = 1.5
BACKOFF_MAX = 60
REQUEST_TIMEOUT = 30

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
}

# Pattern for album links with optional slug: /homes/{username}/albums/{id} or /homes/{username}/albums/{id}-{slug}
# Extracts: (album_path, album_id_with_slug, title) from h3 or link text
ALBUM_LINK_PATTERN = re.compile(
    r"<h3[^>]*>.*?"
    r'<a[^>]*href="(/homes/[^"]+?/albums/(\d+(?:-[\w-]*)?))(?:[?#][^"]*)?"[^>]*>'
    r"([^<]+)</a>.*?</h3>",
    re.DOTALL | re.IGNORECASE,
)

# Fallback pattern: album link directly with title in link text
ALBUM_LINK_FALLBACK_PATTERN = re.compile(
    r'<a[^>]*href="(/homes/[^"]+?/albums/(\d+(?:-[\w-]*)?))(?:[?#][^"]*)?"[^>]*>([^<]+)</a>',
    re.DOTALL,
)

# Pattern for cover images in figure elements
COVER_IMAGE_PATTERN = re.compile(
    r"<figure[^>]*>.*?"
    r'<img[^>]*src="(https://cdn\.assets\.lomography\.com[^"]*)"'
    r".*?</figure>",
    re.DOTALL | re.IGNORECASE,
)

# Simple fallback: any cdn image near album links
CDN_IMAGE_PATTERN = re.compile(
    r'<img[^>]*src="(https://cdn\.assets\.lomography\.com[^"]*)"',
    re.DOTALL,
)


def backoff_delay(attempt: int) -> float:
    base = min(BACKOFF_BASE * (2**attempt), BACKOFF_MAX)
    return base * (0.5 + random.random())


async def fetch_albums_page(
    session: aiohttp.ClientSession, username: str, quick_mode: bool = False
) -> tuple[list[dict], bool]:
    url = f"https://www.lomography.com/homes/{username}/albums"
    max_retries = 1 if quick_mode else MAX_RETRIES

    for attempt in range(max_retries + 1):
        try:
            await asyncio.sleep(REQUEST_DELAY)
            async with session.get(
                url,
                headers=HEADERS,
                timeout=aiohttp.ClientTimeout(total=REQUEST_TIMEOUT),
            ) as resp:
                if resp.status == 429:
                    if quick_mode:
                        return [], True
                    wait = backoff_delay(attempt)
                    print(
                        f"  Albums: HTTP 429, retry {attempt + 1}/{max_retries + 1} in {wait:.1f}s",
                        file=sys.stderr,
                    )
                    await asyncio.sleep(wait)
                    continue

                if resp.status in (500, 502, 503, 504):
                    if quick_mode:
                        return [], False
                    wait = backoff_delay(attempt)
                    print(
                        f"  Albums: HTTP {resp.status}, "
                        f"retry {attempt + 1}/{max_retries + 1} in {wait:.1f}s",
                        file=sys.stderr,
                    )
                    await asyncio.sleep(wait)
                    continue

                if resp.status != 200:
                    print(
                        f"  Albums: HTTP {resp.status}, giving up",
                        file=sys.stderr,
                    )
                    return [], False

                html = await resp.text()

            # Extract album links with titles from h3 elements
            seen: set[str] = set()
            albums: list[dict] = []

            # Try h3 pattern first
            for album_path, album_id, title in ALBUM_LINK_PATTERN.findall(html):
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

            # Fallback: try direct link pattern if h3 pattern didn't find anything
            if not albums:
                for album_path, album_id, title in ALBUM_LINK_FALLBACK_PATTERN.findall(html):
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

            # Extract cover images from figure elements
            cover_images = COVER_IMAGE_PATTERN.findall(html)

            # If no figure images found, fall back to all CDN images
            if not cover_images:
                cover_images = CDN_IMAGE_PATTERN.findall(html)

            # Associate cover images with albums by order
            for i, album in enumerate(albums):
                if i < len(cover_images):
                    album["coverImage"] = cover_images[i]

            return albums, False

        except (aiohttp.ClientError, TimeoutError) as exc:
            if quick_mode:
                return [], False
            wait = backoff_delay(attempt)
            print(
                f"  Albums: {type(exc).__name__}: {exc}, "
                f"retry {attempt + 1}/{max_retries + 1} in {wait:.1f}s",
                file=sys.stderr,
            )
            await asyncio.sleep(wait)

    print("  Albums: all retries exhausted", file=sys.stderr)
    return [], False


async def fetch_all_albums(username: str, quick_mode: bool = False) -> dict:
    connector = aiohttp.TCPConnector(limit=10)
    async with aiohttp.ClientSession(connector=connector) as session:
        # First visit homepage to establish session cookies (bypasses Cloudflare)
        try:
            async with session.get(
                "https://www.lomography.com/",
                headers=HEADERS,
                timeout=aiohttp.ClientTimeout(total=REQUEST_TIMEOUT),
            ):
                pass
        except (aiohttp.ClientError, TimeoutError):
            pass

        albums, rate_limited = await fetch_albums_page(session, username, quick_mode)

    return {
        "username": username,
        "albumCount": len(albums),
        "albums": albums,
        "rateLimited": rate_limited,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch Lomography albums")
    parser.add_argument("username", help="Lomography username")
    parser.add_argument(
        "--quick",
        action="store_true",
        help="Exit early on rate limiting (retries=1)",
    )

    args = parser.parse_args()

    result = asyncio.run(fetch_all_albums(args.username, args.quick))
    print(json.dumps(result))


if __name__ == "__main__":
    main()
