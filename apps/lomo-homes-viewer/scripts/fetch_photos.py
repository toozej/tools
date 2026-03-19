#!/usr/bin/env python3
"""Fetch photos from a Lomography user's photo pages using async requests.

Usage:
    fetch_photos.py <username> <start_page> <end_page>
    fetch_photos.py <username> <page>

Features:
    - Concurrent page fetching with aiohttp (up to 8 simultaneous)
    - Rate limiting to avoid overwhelming the server
    - Exponential backoff with jitter on failures (429, 5xx, connection errors)
    - Tolerates empty batches — stops only after consecutive empty batches
"""

import asyncio
import json
import random
import re
import sys
import time

import aiohttp

# Configuration
MAX_CONCURRENT = 8  # Max simultaneous HTTP requests
REQUEST_DELAY = 0.5  # Minimum seconds between request starts
MAX_RETRIES = 7  # Retries per page on failure
BACKOFF_BASE = 1.5  # Initial backoff delay in seconds
BACKOFF_MAX = 60  # Maximum backoff delay in seconds
REQUEST_TIMEOUT = 30  # Per-request timeout in seconds
TOTAL_TIMEOUT = 300  # Overall script timeout in seconds
MAX_EMPTY_BATCHES = 3  # Stop after this many consecutive batches with no images

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

# Regex to extract photo page links and their associated thumbnail URLs
PHOTO_LINK_PATTERN = re.compile(
    r'<a[^>]*href="(/homes/[^"]*?/photos/\d+)[^"]*"[^>]*>'
    r"(?:[^<]|<(?!/a>))*?"
    r'<img[^>]*src="(https://cdn\.assets\.lomography\.com[^"]*)"'
    r"(?:[^<]|<(?!/a>))*?</a>",
    re.DOTALL,
)


def backoff_delay(attempt: int) -> float:
    """Calculate backoff delay with jitter."""
    base = min(BACKOFF_BASE * (2**attempt), BACKOFF_MAX)
    return base * (0.5 + random.random())


async def fetch_page(
    session: aiohttp.ClientSession,
    semaphore: asyncio.Semaphore,
    rate_lock: asyncio.Lock,
    last_request_time: list[float],
    username: str,
    page: int,
) -> list[dict]:
    """Fetch a single grid page with rate limiting and exponential backoff.

    Returns a list of {"thumbnail": url, "photoPage": path} dicts.
    """
    url = f"https://www.lomography.com/homes/{username}/photos?page={page}"

    for attempt in range(MAX_RETRIES + 1):
        # Rate limiting: ensure minimum gap between outgoing requests
        async with rate_lock:
            elapsed = time.monotonic() - last_request_time[0]
            if elapsed < REQUEST_DELAY:
                await asyncio.sleep(REQUEST_DELAY - elapsed)
            last_request_time[0] = time.monotonic()

        try:
            async with semaphore:
                async with session.get(
                    url,
                    headers=HEADERS,
                    timeout=aiohttp.ClientTimeout(total=REQUEST_TIMEOUT),
                ) as resp:
                    # Retry on rate-limit or server errors
                    if resp.status in (429, 500, 502, 503, 504):
                        wait = backoff_delay(attempt)
                        print(
                            f"  Page {page}: HTTP {resp.status}, "
                            f"retry {attempt + 1}/{MAX_RETRIES + 1} in {wait:.1f}s",
                            file=sys.stderr,
                        )
                        await asyncio.sleep(wait)
                        continue

                    if resp.status != 200:
                        print(
                            f"  Page {page}: HTTP {resp.status}, giving up",
                            file=sys.stderr,
                        )
                        return []

                    html = await resp.text()

                # Extract photo page links paired with their thumbnail URLs
                seen: set[str] = set()
                pairs: list[dict] = []
                for page_link, thumb_url in PHOTO_LINK_PATTERN.findall(html):
                    if thumb_url not in seen:
                        seen.add(thumb_url)
                        pairs.append({"thumbnail": thumb_url, "photoPage": page_link})

                return pairs

        except (aiohttp.ClientError, TimeoutError) as exc:
            wait = backoff_delay(attempt)
            print(
                f"  Page {page}: {type(exc).__name__}: {exc}, "
                f"retry {attempt + 1}/{MAX_RETRIES + 1} in {wait:.1f}s",
                file=sys.stderr,
            )
            await asyncio.sleep(wait)

    print(f"  Page {page}: all retries exhausted", file=sys.stderr)
    return []


async def fetch_all_pages(username: str, start_page: int, end_page: int) -> dict:
    """Fetch pages concurrently and collect thumbnail + photo page link pairs.

    Stops early if consecutive batches return zero images.
    """
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)
    rate_lock = asyncio.Lock()
    last_request_time = [0.0]

    all_images: list[dict] = []
    seen: set[str] = set()
    last_page_reached = start_page - 1
    consecutive_empty = 0

    connector = aiohttp.TCPConnector(limit=MAX_CONCURRENT + 5)
    async with aiohttp.ClientSession(connector=connector) as session:
        page = start_page
        while page <= end_page:
            batch_end = min(page + MAX_CONCURRENT - 1, end_page)
            tasks = [
                fetch_page(session, semaphore, rate_lock, last_request_time, username, p)
                for p in range(page, batch_end + 1)
            ]
            results = await asyncio.gather(*tasks)

            any_images = False
            for p, pairs in zip(range(page, batch_end + 1), results):
                if pairs:
                    any_images = True
                    last_page_reached = p
                    for pair in pairs:
                        thumb = pair["thumbnail"]
                        if thumb not in seen:
                            seen.add(thumb)
                            all_images.append(pair)

            if not any_images:
                consecutive_empty += 1
                print(
                    f"No images found in pages {page}-{batch_end} "
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
        "imageCount": len(all_images),
        "images": all_images,
        "pagesScanned": last_page_reached - start_page + 1,
    }


def main() -> None:
    if len(sys.argv) < 3:
        print(
            "Usage: fetch_photos.py <username> <start_page> [end_page]",
            file=sys.stderr,
        )
        sys.exit(1)

    username = sys.argv[1]
    start_page = int(sys.argv[2])
    end_page = int(sys.argv[3]) if len(sys.argv) > 3 else start_page

    result = asyncio.run(fetch_all_pages(username, start_page, end_page))
    print(json.dumps(result))


if __name__ == "__main__":
    main()
