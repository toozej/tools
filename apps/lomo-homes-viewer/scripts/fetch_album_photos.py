#!/usr/bin/env python3
"""Fetch photos from a specific Lomography album using async requests.

Usage:
    fetch_album_photos.py <username> <album_id> <start_page> <end_page>
    fetch_album_photos.py <username> <album_id> <page>

Features:
    - Concurrent page fetching with aiohttp (up to 8 simultaneous)
    - Rate limiting and exponential backoff identical to fetch_photos.py
    - Extracts thumbnail URLs and photo page links from album pages
    - --quick flag: exit early on rate limiting (retries=1, faster failure)
"""

import argparse
import asyncio
import json
import random
import re
import sys
import time

import aiohttp

MAX_CONCURRENT = 8
REQUEST_DELAY = 0.5
MAX_RETRIES = 7
BACKOFF_BASE = 1.5
BACKOFF_MAX = 60
REQUEST_TIMEOUT = 30
TOTAL_TIMEOUT = 300
MAX_EMPTY_BATCHES = 3

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

PHOTO_LINK_PATTERN = re.compile(
    r'<a[^>]*href="(/homes/[^"]+?/albums/\d+[^/]*/\d+)"[^>]*>'
    r"(?:[^<]|<(?!/a>))*?"
    r'<img[^>]*src="(https://cdn\.assets\.lomography\.com[^"]*)"'
    r"(?:[^<]|<(?!/a>))*?</a>",
    re.DOTALL,
)


def backoff_delay(attempt: int) -> float:
    base = min(BACKOFF_BASE * (2**attempt), BACKOFF_MAX)
    return base * (0.5 + random.random())


async def fetch_page(
    session: aiohttp.ClientSession,
    semaphore: asyncio.Semaphore,
    rate_lock: asyncio.Lock,
    last_request_time: list[float],
    username: str,
    album_id: str,
    page: int,
    quick_mode: bool = False,
) -> tuple[list[dict], bool]:
    url = f"https://www.lomography.com/homes/{username}/albums/{album_id}?page={page}"
    max_retries = 1 if quick_mode else MAX_RETRIES

    for attempt in range(max_retries + 1):
        async with rate_lock:
            elapsed = time.monotonic() - last_request_time[0]
            delay = 0 if quick_mode else REQUEST_DELAY
            if elapsed < delay:
                await asyncio.sleep(delay - elapsed)
            last_request_time[0] = time.monotonic()

        try:
            async with semaphore:
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
                            f"  Album page {page}: HTTP 429, "
                            f"retry {attempt + 1}/{max_retries + 1} in {wait:.1f}s",
                            file=sys.stderr,
                        )
                        await asyncio.sleep(wait)
                        continue

                    if resp.status in (500, 502, 503, 504):
                        if quick_mode:
                            return [], False
                        wait = backoff_delay(attempt)
                        print(
                            f"  Album page {page}: HTTP {resp.status}, "
                            f"retry {attempt + 1}/{max_retries + 1} in {wait:.1f}s",
                            file=sys.stderr,
                        )
                        await asyncio.sleep(wait)
                        continue

                    if resp.status != 200:
                        print(
                            f"  Album page {page}: HTTP {resp.status}, giving up",
                            file=sys.stderr,
                        )
                        return [], False

                    html = await resp.text()

                seen: set[str] = set()
                pairs: list[dict] = []
                for page_link, thumb_url in PHOTO_LINK_PATTERN.findall(html):
                    if thumb_url not in seen:
                        seen.add(thumb_url)
                        pairs.append({"thumbnail": thumb_url, "photoPage": page_link})

                return pairs, False

        except (aiohttp.ClientError, TimeoutError) as exc:
            if quick_mode:
                return [], False
            wait = backoff_delay(attempt)
            print(
                f"  Album page {page}: {type(exc).__name__}: {exc}, "
                f"retry {attempt + 1}/{max_retries + 1} in {wait:.1f}s",
                file=sys.stderr,
            )
            await asyncio.sleep(wait)

    print(f"  Album page {page}: all retries exhausted", file=sys.stderr)
    return [], False


async def fetch_all_pages(
    username: str,
    album_id: str,
    start_page: int,
    end_page: int,
    quick_mode: bool = False,
) -> dict:
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)
    rate_lock = asyncio.Lock()
    last_request_time = [0.0]

    all_images: list[dict] = []
    seen: set[str] = set()
    last_page_reached = start_page - 1
    consecutive_empty = 0
    rate_limited = False

    connector = aiohttp.TCPConnector(limit=MAX_CONCURRENT + 5)
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

        page = start_page
        has_found_images = False
        while page <= end_page:
            batch_end = min(page + MAX_CONCURRENT - 1, end_page)
            tasks = [
                fetch_page(
                    session,
                    semaphore,
                    rate_lock,
                    last_request_time,
                    username,
                    album_id,
                    p,
                    quick_mode,
                )
                for p in range(page, batch_end + 1)
            ]
            results = await asyncio.gather(*tasks)

            any_images = False
            reached_album_end = False
            for p, (pairs, was_rate_limited) in zip(range(page, batch_end + 1), results):
                if was_rate_limited:
                    rate_limited = True
                    break
                if pairs:
                    any_images = True
                    has_found_images = True
                    last_page_reached = p
                    for pair in pairs:
                        thumb = pair["thumbnail"]
                        if thumb not in seen:
                            seen.add(thumb)
                            all_images.append(pair)
                elif has_found_images:
                    reached_album_end = True
                    break

            if rate_limited:
                break

            if reached_album_end:
                print(
                    f"Reached end of album at page {last_page_reached}.",
                    file=sys.stderr,
                )
                break

            if not any_images:
                consecutive_empty += 1
                print(
                    f"No images found in album pages {page}-{batch_end} "
                    f"({consecutive_empty}/{MAX_EMPTY_BATCHES} empty batches).",
                    file=sys.stderr,
                )
                if consecutive_empty >= MAX_EMPTY_BATCHES:
                    print("Too many empty batches, stopping.", file=sys.stderr)
                    break
            else:
                consecutive_empty = 0

            page = batch_end + 1

    return {
        "username": username,
        "albumId": album_id,
        "imageCount": len(all_images),
        "images": all_images,
        "pagesScanned": last_page_reached - start_page + 1,
        "rateLimited": rate_limited,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch photos from a Lomography album")
    parser.add_argument("username", help="Lomography username")
    parser.add_argument("album_id", help="Album ID (with optional slug)")
    parser.add_argument("start_page", type=int, help="Start page number")
    parser.add_argument("end_page", type=int, nargs="?", help="End page number (optional)")
    parser.add_argument(
        "--quick",
        action="store_true",
        help="Exit early on rate limiting (retries=1)",
    )

    args = parser.parse_args()
    end_page = args.end_page if args.end_page else args.start_page

    result = asyncio.run(
        fetch_all_pages(args.username, args.album_id, args.start_page, end_page, args.quick)
    )
    print(json.dumps(result))


if __name__ == "__main__":
    main()
