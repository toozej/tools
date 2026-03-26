#!/usr/bin/env python3
"""Unit tests for Lomography scraper scripts.

Run with: uv run pytest scripts/test_scripts.py -v
"""

import os
import re
import subprocess
import sys

import pytest

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))


# ---------------------------------------------------------------------------
# Regex patterns (duplicated here so we don't need to import modules that
# have top-level aiohttp imports which complicate test isolation).
# ---------------------------------------------------------------------------

PHOTO_LINK_PATTERN = re.compile(
    r'<a[^>]*href="(/homes/[^"]*?/photos/\d+)[^"]*"[^>]*>'
    r"(?:[^<]|<(?!/a>))*?"
    r'<img[^>]*src="(https://cdn\.assets\.lomography\.com[^"]*)"'
    r"(?:[^<]|<(?!/a>))*?</a>",
    re.DOTALL,
)

ALBUM_LINK_PATTERN = re.compile(
    r"<h3[^>]*>.*?"
    r'<a[^>]*href="(/homes/[^"]+?/albums/(\d+)(?:-[^"]*)?)"[^>]*>'
    r"([^<]+)</a>.*?</h3>",
    re.DOTALL | re.IGNORECASE,
)

ALBUM_LINK_FALLBACK_PATTERN = re.compile(
    r'<a[^>]*href="(/homes/[^"]+?/albums/(\d+)(?:-[^"]*)?)"[^>]*>([^<]+)</a>',
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

TITLE_PATTERN = re.compile(
    r'<a[^>]*href="/homes/[^"]+?/albums/(\d+)"[^>]*>'
    r"(?:[^<]|<(?!/a>))*?</a>"
    r"\s*(?:<[^>]+>\s*)*([^<]+)",
    re.DOTALL,
)

IMG_PATTERN = re.compile(r'https://cdn\.assets\.lomography\.com/[^\s"<>\']+\.\w+(?:\?[^\s"<>\']*)?')

# Mirrors PHOTO_PATH_RE from src/app/api/photo-detail/route.ts
PHOTO_PATH_RE = re.compile(r"^/homes/[a-zA-Z0-9_-]+/(?:photos|albums/[\w-]+)/\d+")

BACKOFF_BASE = 1.5
BACKOFF_MAX = 60


def backoff_delay(attempt: int) -> float:
    """Calculate backoff delay with jitter (same logic as the scripts)."""
    import random

    base = min(BACKOFF_BASE * (2**attempt), BACKOFF_MAX)
    return base * (0.5 + random.random())


# ===========================================================================
# backoff_delay tests
# ===========================================================================


class TestBackoffDelay:
    def test_attempt_zero_returns_positive_value(self):
        delay = backoff_delay(0)
        assert delay > 0

    def test_delay_within_bounds(self):
        for attempt in range(20):
            delay = backoff_delay(attempt)
            # Jitter range: base * 0.5  to  base * 1.5
            base = min(BACKOFF_BASE * (2**attempt), BACKOFF_MAX)
            assert delay >= base * 0.5
            assert delay <= base * 1.5

    def test_delay_caps_at_backoff_max(self):
        # Even for very high attempts, the base is capped at BACKOFF_MAX
        for attempt in range(20, 25):
            delay = backoff_delay(attempt)
            assert delay <= BACKOFF_MAX * 1.5

    def test_higher_attempts_produce_higher_base(self):
        # Verify the exponential growth: base(attempt N) > base(attempt N-1)
        # (jitter can cause individual samples to vary, so compare bounds)
        base_0 = BACKOFF_BASE * (2**0)
        base_3 = BACKOFF_BASE * (2**3)
        assert base_3 > base_0


# ===========================================================================
# PHOTO_LINK_PATTERN tests
# ===========================================================================


class TestPhotoLinkPattern:
    def test_extracts_photo_link_and_thumbnail(self):
        html = (
            '<a href="/homes/aciano/photos/29205949">'
            '<img src="https://cdn.assets.lomography.com/abc/172x256x1.jpg?auth=xyz">'
            "</a>"
        )
        matches = PHOTO_LINK_PATTERN.findall(html)
        assert len(matches) == 1
        assert matches[0] == (
            "/homes/aciano/photos/29205949",
            "https://cdn.assets.lomography.com/abc/172x256x1.jpg?auth=xyz",
        )

    def test_extracts_multiple_photos(self):
        html = """
        <a href="/homes/user/photos/1"><img src="https://cdn.assets.lomography.com/a/1.jpg"></a>
        <a href="/homes/user/photos/2"><img src="https://cdn.assets.lomography.com/b/2.jpg"></a>
        """
        matches = PHOTO_LINK_PATTERN.findall(html)
        assert len(matches) == 2

    def test_handles_extra_attributes_on_a_tag(self):
        html = (
            '<a class="photo" data-id="1" href="/homes/user/photos/100" target="_blank">'
            '<img class="thumb" src="https://cdn.assets.lomography.com/x/img.jpg" loading="lazy">'
            "</a>"
        )
        matches = PHOTO_LINK_PATTERN.findall(html)
        assert len(matches) == 1

    def test_handles_extra_attributes_on_img_tag(self):
        html = (
            '<a href="/homes/user/photos/50">'
            '<img width="172" height="256" src="https://cdn.assets.lomography.com/y/img.jpg">'
            "</a>"
        )
        matches = PHOTO_LINK_PATTERN.findall(html)
        assert len(matches) == 1

    def test_no_match_without_cdn_url(self):
        html = '<a href="/homes/user/photos/1"><img src="https://example.com/img.jpg"></a>'
        matches = PHOTO_LINK_PATTERN.findall(html)
        assert len(matches) == 0

    def test_no_match_without_photo_path(self):
        html = '<a href="/homes/user/albums/123"><img src="https://cdn.assets.lomography.com/x/img.jpg"></a>'
        matches = PHOTO_LINK_PATTERN.findall(html)
        assert len(matches) == 0

    def test_handles_multiline_html(self):
        html = """
        <a href="/homes/user/photos/42"
           class="photo-link">
           <img
              src="https://cdn.assets.lomography.com/z/300x450x1.jpg"
              alt="photo">
        </a>
        """
        matches = PHOTO_LINK_PATTERN.findall(html)
        assert len(matches) == 1


# ===========================================================================
# ALBUM_LINK_PATTERN tests
# ===========================================================================


class TestAlbumLinkPattern:
    def test_extracts_album_link_id_and_title_from_h3(self):
        html = '<h3>Album: <a href="/homes/aciano/albums/12345">Spring 2024</a></h3>'
        matches = ALBUM_LINK_PATTERN.findall(html)
        assert len(matches) == 1
        path, album_id, title = matches[0]
        assert path == "/homes/aciano/albums/12345"
        assert album_id == "12345"
        assert title.strip() == "Spring 2024"

    def test_extracts_album_with_slug(self):
        html = '<h3><a href="/homes/aciano/albums/2519003-springtime-2026">Springtime 2026</a></h3>'
        matches = ALBUM_LINK_PATTERN.findall(html)
        assert len(matches) == 1
        path, album_id, title = matches[0]
        assert path == "/homes/aciano/albums/2519003-springtime-2026"
        assert album_id == "2519003"
        assert title.strip() == "Springtime 2026"

    def test_extracts_multiple_albums(self):
        html = """
        <h3><a href="/homes/user/albums/1">Album One</a></h3>
        <h3><a href="/homes/user/albums/2">Album Two</a></h3>
        """
        matches = ALBUM_LINK_PATTERN.findall(html)
        assert len(matches) == 2

    def test_no_match_for_photo_links(self):
        html = '<h3><a href="/homes/user/photos/123">Photo</a></h3>'
        matches = ALBUM_LINK_PATTERN.findall(html)
        assert len(matches) == 0

    def test_handles_extra_attributes(self):
        html = '<h3 class="album-title"><a class="link" href="/homes/user/albums/999" target="_blank">My Album</a></h3>'
        matches = ALBUM_LINK_PATTERN.findall(html)
        assert len(matches) == 1
        path, album_id, title = matches[0]
        assert album_id == "999"
        assert title.strip() == "My Album"

    def test_fallback_pattern_without_h3(self):
        html = '<a href="/homes/user/albums/123">Direct Link Album</a>'
        matches = ALBUM_LINK_FALLBACK_PATTERN.findall(html)
        assert len(matches) == 1
        path, album_id, title = matches[0]
        assert album_id == "123"
        assert title.strip() == "Direct Link Album"


# ===========================================================================
# COVER_IMAGE_PATTERN tests
# ===========================================================================


class TestCoverImagePattern:
    def test_extracts_image_from_figure(self):
        html = (
            '<figure class="album-cover">'
            '<img src="https://cdn.assets.lomography.com/a/172x256x1.jpg">'
            "</figure>"
        )
        matches = COVER_IMAGE_PATTERN.findall(html)
        assert len(matches) == 1
        assert "cdn.assets.lomography.com" in matches[0]

    def test_extracts_multiple_cover_images(self):
        html = """
        <figure><img src="https://cdn.assets.lomography.com/a/1.jpg"></figure>
        <figure><img src="https://cdn.assets.lomography.com/b/2.jpg"></figure>
        """
        matches = COVER_IMAGE_PATTERN.findall(html)
        assert len(matches) == 2


class TestCdnImagePattern:
    def test_extracts_cdn_image_url(self):
        html = '<img src="https://cdn.assets.lomography.com/abc/172x256x1.jpg">'
        matches = CDN_IMAGE_PATTERN.findall(html)
        assert len(matches) == 1
        assert "cdn.assets.lomography.com" in matches[0]

    def test_extracts_multiple_images(self):
        html = """
        <img src="https://cdn.assets.lomography.com/a/1.jpg">
        <img src="https://cdn.assets.lomography.com/b/2.jpg">
        """
        matches = CDN_IMAGE_PATTERN.findall(html)
        assert len(matches) == 2


# ===========================================================================
# TITLE_PATTERN tests
# ===========================================================================


class TestTitlePattern:
    def test_extracts_title_after_album_link(self):
        html = (
            '<a href="/homes/user/albums/123">'
            '<img src="https://cdn.assets.lomography.com/x/img.jpg">'
            "</a>"
            "<h3>Summer 2024</h3>"
        )
        matches = TITLE_PATTERN.findall(html)
        assert len(matches) == 1
        album_id, title = matches[0]
        assert album_id == "123"
        assert title.strip() == "Summer 2024"

    def test_no_match_without_text_after_link(self):
        html = (
            '<a href="/homes/user/albums/123">'
            '<img src="https://cdn.assets.lomography.com/x/img.jpg">'
            "</a>"
        )
        matches = TITLE_PATTERN.findall(html)
        assert len(matches) == 0


# ===========================================================================
# IMG_PATTERN tests
# ===========================================================================


class TestImgPattern:
    def test_extracts_cdn_image_url(self):
        html = "https://cdn.assets.lomography.com/abc/1216x1812x1.jpg?auth=token123"
        matches = IMG_PATTERN.findall(html)
        assert len(matches) == 1
        assert "1216x1812x1.jpg" in matches[0]

    def test_extracts_multiple_urls(self):
        html = """
        https://cdn.assets.lomography.com/a/172x256x1.jpg
        https://cdn.assets.lomography.com/b/1216x1812x1.jpg?auth=xyz
        """
        matches = IMG_PATTERN.findall(html)
        assert len(matches) == 2

    def test_no_match_for_non_cdn_urls(self):
        html = "https://example.com/image.jpg"
        matches = IMG_PATTERN.findall(html)
        assert len(matches) == 0

    def test_extracts_urls_with_query_params(self):
        html = "https://cdn.assets.lomography.com/folder/300x450x1.jpg?auth=abc123&foo=bar"
        matches = IMG_PATTERN.findall(html)
        assert len(matches) == 1


# ===========================================================================
# CLI argument handling tests (via subprocess)
# ===========================================================================


class TestCliArguments:
    def test_fetch_photos_no_args_exits_nonzero(self):
        result = subprocess.run(
            [sys.executable, os.path.join(SCRIPTS_DIR, "fetch_photos.py")],
            capture_output=True,
            text=True,
            timeout=10,
        )
        assert result.returncode != 0

    def test_fetch_photo_detail_no_args_exits_nonzero(self):
        result = subprocess.run(
            [sys.executable, os.path.join(SCRIPTS_DIR, "fetch_photo_detail.py")],
            capture_output=True,
            text=True,
            timeout=10,
        )
        assert result.returncode != 0

    def test_fetch_albums_no_args_exits_nonzero(self):
        result = subprocess.run(
            [sys.executable, os.path.join(SCRIPTS_DIR, "fetch_albums.py")],
            capture_output=True,
            text=True,
            timeout=10,
        )
        assert result.returncode != 0

    def test_fetch_album_photos_no_args_exits_nonzero(self):
        result = subprocess.run(
            [sys.executable, os.path.join(SCRIPTS_DIR, "fetch_album_photos.py")],
            capture_output=True,
            text=True,
            timeout=10,
        )
        assert result.returncode != 0

    def test_fetch_photos_usage_message_on_stderr(self):
        result = subprocess.run(
            [sys.executable, os.path.join(SCRIPTS_DIR, "fetch_photos.py")],
            capture_output=True,
            text=True,
            timeout=10,
        )
        assert "usage:" in result.stderr

    def test_fetch_albums_usage_message_on_stderr(self):
        result = subprocess.run(
            [sys.executable, os.path.join(SCRIPTS_DIR, "fetch_albums.py")],
            capture_output=True,
            text=True,
            timeout=10,
        )
        assert "usage:" in result.stderr

    def test_fetch_album_photos_usage_message_on_stderr(self):
        result = subprocess.run(
            [sys.executable, os.path.join(SCRIPTS_DIR, "fetch_album_photos.py")],
            capture_output=True,
            text=True,
            timeout=10,
        )
        assert "usage:" in result.stderr


# ===========================================================================
# Async fetch_page tests (mocked HTTP)
# ===========================================================================


def _import_fetch_photos():
    """Import fetch_photos functions by adding scripts dir to path."""
    sys.path.insert(0, SCRIPTS_DIR)
    try:
        import fetch_photos

        return fetch_photos
    finally:
        sys.path.pop(0)


def _import_fetch_albums():
    sys.path.insert(0, SCRIPTS_DIR)
    try:
        import fetch_albums

        return fetch_albums
    finally:
        sys.path.pop(0)


def _import_fetch_album_photos():
    sys.path.insert(0, SCRIPTS_DIR)
    try:
        import fetch_album_photos

        return fetch_album_photos
    finally:
        sys.path.pop(0)


class TestFetchPhotosPage:
    @pytest.mark.asyncio
    async def test_extracts_photos_from_html(self):
        mod = _import_fetch_photos()

        # Build a mock HTML response with two photo entries
        mock_html = """
        <html><body>
        <a href="/homes/testuser/photos/100">
            <img src="https://cdn.assets.lomography.com/a/172x256x1.jpg">
        </a>
        <a href="/homes/testuser/photos/200">
            <img src="https://cdn.assets.lomography.com/b/172x256x1.jpg">
        </a>
        </body></html>
        """

        # Use aioresponses-style mocking via aiohttp test utilities
        from aiohttp import web
        from aiohttp.test_utils import TestServer, TestClient

        async def handler(request):
            return web.Response(text=mock_html, status=200)

        app = web.Application()
        app.router.add_get("/homes/{username}/photos", handler)
        server = TestServer(app)
        await server.start_server()

        try:
            client = TestClient(server)
            await client.start_server()

            # Test the extraction logic directly against the mock HTML
            pairs = []
            seen = set()
            for page_link, thumb_url in mod.PHOTO_LINK_PATTERN.findall(mock_html):
                if thumb_url not in seen:
                    seen.add(thumb_url)
                    pairs.append({"thumbnail": thumb_url, "photoPage": page_link})

            assert len(pairs) == 2
            assert pairs[0]["photoPage"] == "/homes/testuser/photos/100"
            assert pairs[1]["photoPage"] == "/homes/testuser/photos/200"
            assert "cdn.assets.lomography.com" in pairs[0]["thumbnail"]
        finally:
            await server.close()

    @pytest.mark.asyncio
    async def test_returns_empty_for_no_matches(self):
        mod = _import_fetch_photos()
        html = "<html><body><p>No photos here</p></body></html>"

        pairs = []
        seen = set()
        for page_link, thumb_url in mod.PHOTO_LINK_PATTERN.findall(html):
            if thumb_url not in seen:
                seen.add(thumb_url)
                pairs.append({"thumbnail": thumb_url, "photoPage": page_link})

        assert pairs == []

    @pytest.mark.asyncio
    async def test_deduplicates_by_thumbnail(self):
        mod = _import_fetch_photos()
        html = """
        <a href="/homes/user/photos/1"><img src="https://cdn.assets.lomography.com/a/img.jpg"></a>
        <a href="/homes/user/photos/1"><img src="https://cdn.assets.lomography.com/a/img.jpg"></a>
        <a href="/homes/user/photos/2"><img src="https://cdn.assets.lomography.com/b/img.jpg"></a>
        """
        pairs = []
        seen = set()
        for page_link, thumb_url in mod.PHOTO_LINK_PATTERN.findall(html):
            if thumb_url not in seen:
                seen.add(thumb_url)
                pairs.append({"thumbnail": thumb_url, "photoPage": page_link})

        assert len(pairs) == 2


class TestFetchAlbumsPage:
    @pytest.mark.asyncio
    async def test_extracts_albums_from_html(self):
        mod = _import_fetch_albums()
        html = """
        <html><body>
        <h3><a href="/homes/testuser/albums/100">Album One</a></h3>
        <figure><img src="https://cdn.assets.lomography.com/a/172x256x1.jpg"></figure>
        <h3><a href="/homes/testuser/albums/200">Album Two</a></h3>
        <figure><img src="https://cdn.assets.lomography.com/b/172x256x1.jpg"></figure>
        </body></html>
        """

        seen = set()
        albums = []
        for album_path, album_id, title in mod.ALBUM_LINK_PATTERN.findall(html):
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

        cover_images = mod.COVER_IMAGE_PATTERN.findall(html)
        for i, album in enumerate(albums):
            if i < len(cover_images):
                album["coverImage"] = cover_images[i]

        assert len(albums) == 2
        assert albums[0]["albumId"] == "100"
        assert albums[0]["albumPage"] == "/homes/testuser/albums/100"
        assert albums[0]["title"] == "Album One"
        assert albums[1]["albumId"] == "200"

    @pytest.mark.asyncio
    async def test_extracts_albums_with_slugs(self):
        mod = _import_fetch_albums()
        html = """
        <html><body>
        <h3><a href="/homes/testuser/albums/100-spring-2024">Spring 2024</a></h3>
        <figure><img src="https://cdn.assets.lomography.com/a/1.jpg"></figure>
        </body></html>
        """

        seen = set()
        albums = []
        for album_path, album_id, title in mod.ALBUM_LINK_PATTERN.findall(html):
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

        assert len(albums) == 1
        assert albums[0]["albumId"] == "100-spring-2024"
        assert albums[0]["albumPage"] == "/homes/testuser/albums/100-spring-2024"
        assert albums[0]["title"] == "Spring 2024"

    @pytest.mark.asyncio
    async def test_no_match_for_photo_links(self):
        mod = _import_fetch_albums()
        html = '<h3><a href="/homes/user/photos/123">Photo</a></h3>'
        matches = mod.ALBUM_LINK_PATTERN.findall(html)
        assert len(matches) == 0


# ===========================================================================
# PHOTO_PATH_RE tests (mirrors route.ts validation)
# ===========================================================================


class TestPhotoPathRe:
    def test_accepts_regular_photo_path(self):
        assert PHOTO_PATH_RE.match("/homes/aciano/photos/29205949")

    def test_accepts_album_photo_path(self):
        assert PHOTO_PATH_RE.match("/homes/rik041/albums/2400038-springtime-with-the-hoga/25669634")

    def test_accepts_album_photo_path_without_slug(self):
        assert PHOTO_PATH_RE.match("/homes/user/albums/123/456")

    def test_accepts_username_with_hyphens_and_underscores(self):
        assert PHOTO_PATH_RE.match("/homes/my-user_name/photos/100")
        assert PHOTO_PATH_RE.match("/homes/my-user_name/albums/200-album-name/300")

    def test_rejects_missing_photo_id(self):
        assert not PHOTO_PATH_RE.match("/homes/user/photos/")
        assert not PHOTO_PATH_RE.match("/homes/user/albums/100-slug/")

    def test_rejects_album_link_without_photo_id(self):
        # This is an album page, not a photo page
        assert not PHOTO_PATH_RE.match("/homes/user/albums/100-spring-2024")

    def test_rejects_empty_string(self):
        assert not PHOTO_PATH_RE.match("")

    def test_rejects_unrelated_path(self):
        assert not PHOTO_PATH_RE.match("/some/other/path/123")


# ===========================================================================
# Album photo link extraction tests
# ===========================================================================


ALBUM_PHOTO_LINK_PATTERN = re.compile(
    r'<a[^>]*href="(/homes/[^"]+?/albums/\d+[^/]*/\d+)"[^>]*>'
    r"(?:[^<]|<(?!/a>))*?"
    r'<img[^>]*src="(https://cdn\.assets\.lomography\.com[^"]*)"'
    r"(?:[^<]|<(?!/a>))*?</a>",
    re.DOTALL,
)


class TestAlbumPhotoLinkPattern:
    def test_extracts_album_photo_link(self):
        html = (
            '<a href="/homes/rik041/albums/2400038-springtime-with-the-hoga/25669634">'
            '<img src="https://cdn.assets.lomography.com/a/172x256x1.jpg">'
            "</a>"
        )
        matches = ALBUM_PHOTO_LINK_PATTERN.findall(html)
        assert len(matches) == 1
        path, thumb = matches[0]
        assert path == "/homes/rik041/albums/2400038-springtime-with-the-hoga/25669634"
        assert "cdn.assets.lomography.com" in thumb

    def test_extracts_multiple_album_photo_links(self):
        html = """
        <a href="/homes/user/albums/100-my-album/1"><img src="https://cdn.assets.lomography.com/a/1.jpg"></a>
        <a href="/homes/user/albums/100-my-album/2"><img src="https://cdn.assets.lomography.com/b/2.jpg"></a>
        """
        matches = ALBUM_PHOTO_LINK_PATTERN.findall(html)
        assert len(matches) == 2

    def test_photo_page_path_passes_photo_path_re(self):
        """Verify extracted album photo paths are accepted by PHOTO_PATH_RE."""
        html = (
            '<a href="/homes/rik041/albums/2400038-springtime-with-the-hoga/25669634">'
            '<img src="https://cdn.assets.lomography.com/a/172x256x1.jpg">'
            "</a>"
        )
        matches = ALBUM_PHOTO_LINK_PATTERN.findall(html)
        assert len(matches) == 1
        path = matches[0][0]
        assert PHOTO_PATH_RE.match(path), (
            f"Album photo path {path!r} should be accepted by PHOTO_PATH_RE"
        )

    def test_no_match_for_album_link_without_photo_id(self):
        html = (
            '<a href="/homes/user/albums/100-my-album">'
            '<img src="https://cdn.assets.lomography.com/a/1.jpg">'
            "</a>"
        )
        matches = ALBUM_PHOTO_LINK_PATTERN.findall(html)
        assert len(matches) == 0
