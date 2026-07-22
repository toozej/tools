#!/usr/bin/env python3
"""Shared HTTP transport for Lomography scraper scripts.

Lomography protects profile pages with a Cloudflare managed challenge. In the
container stack, requests are sent through the private FlareSolverr service so
that a real browser can solve the challenge and retain its clearance cookies.
When FLARESOLVERR_URL is unset, a direct HTTP request is used for local testing.
"""

from __future__ import annotations

import fcntl
import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

DEFAULT_TIMEOUT_SECONDS = 60
DEFAULT_SESSION_TTL_MINUTES = 30
DEFAULT_SESSION_NAME = "lomo-homes-viewer"
LOCK_PATH = Path("/tmp/lomo-homes-viewer-flaresolverr.lock")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/148.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


class LomographyClientError(RuntimeError):
    """Raised when a Lomography page cannot be retrieved."""

    def __init__(self, message: str, status: int | None = None) -> None:
        super().__init__(message)
        self.status = status


class LomographyRateLimitError(LomographyClientError):
    """Raised when Lomography explicitly rate limits a request."""


class LomographyClient:
    """Fetch Lomography HTML through one serialized FlareSolverr session."""

    def __init__(self) -> None:
        self.endpoint = os.environ.get("FLARESOLVERR_URL", "").strip()
        self.session_name = os.environ.get("FLARESOLVERR_SESSION", DEFAULT_SESSION_NAME).strip()
        self.timeout_seconds = int(
            os.environ.get("FLARESOLVERR_TIMEOUT_SECONDS", DEFAULT_TIMEOUT_SECONDS)
        )
        self.session_ttl_minutes = int(
            os.environ.get("FLARESOLVERR_SESSION_TTL_MINUTES", DEFAULT_SESSION_TTL_MINUTES)
        )
        self._lock_file = None

    def __enter__(self) -> LomographyClient:
        if self.endpoint:
            self._lock_file = LOCK_PATH.open("a+", encoding="utf-8")
            fcntl.flock(self._lock_file.fileno(), fcntl.LOCK_EX)
            try:
                self._ensure_session()
            except Exception:
                self._release_lock()
                raise
        return self

    def __exit__(self, exc_type: object, exc: object, traceback: object) -> None:
        self._release_lock()

    def _release_lock(self) -> None:
        if self._lock_file is not None:
            fcntl.flock(self._lock_file.fileno(), fcntl.LOCK_UN)
            self._lock_file.close()
            self._lock_file = None

    def get(self, url: str) -> str:
        """Return rendered HTML for a Lomography URL."""
        if not self.endpoint:
            return self._direct_get(url)

        try:
            return self._solver_get(url)
        except LomographyClientError as exc:
            if not self._is_missing_session_error(str(exc)):
                raise

        # FlareSolverr may rotate an expired browser session. Recreate it once
        # and retry the page request without exposing that lifecycle to callers.
        self._create_session()
        return self._solver_get(url)

    def _direct_get(self, url: str) -> str:
        request = urllib.request.Request(url, headers=HEADERS)
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
                status = response.status
                html = response.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as exc:
            if exc.code == 429:
                raise LomographyRateLimitError(
                    "Lomography rate limited the request", status=exc.code
                ) from exc
            raise LomographyClientError(
                f"Lomography returned HTTP {exc.code}", status=exc.code
            ) from exc
        except urllib.error.URLError as exc:
            raise LomographyClientError(f"Lomography request failed: {exc.reason}") from exc

        self._validate_page(html, status)
        return html

    def _solver_get(self, url: str) -> str:
        result = self._call_solver(
            {
                "cmd": "request.get",
                "url": url,
                "session": self.session_name,
                "session_ttl_minutes": self.session_ttl_minutes,
                "maxTimeout": self.timeout_seconds * 1000,
                "disableMedia": True,
            }
        )

        solution = result.get("solution") or {}
        status = int(solution.get("status") or 0)
        html = solution.get("response") or ""

        if status == 429:
            raise LomographyRateLimitError("Lomography rate limited the request", status=status)
        if status != 200:
            raise LomographyClientError(
                f"Lomography returned HTTP {status or 'unknown'} through FlareSolverr",
                status=status or None,
            )

        self._validate_page(html, status)
        return html

    def _ensure_session(self) -> None:
        result = self._call_solver({"cmd": "sessions.list"})
        sessions = result.get("sessions") or []
        if self.session_name not in sessions:
            self._create_session()

    def _create_session(self) -> None:
        result = self._call_solver({"cmd": "sessions.create", "session": self.session_name})
        session = result.get("session")
        if session != self.session_name:
            raise LomographyClientError(
                f"FlareSolverr did not create session {self.session_name!r}"
            )

    def _call_solver(self, payload: dict[str, Any]) -> dict[str, Any]:
        body = json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            self.endpoint,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(request, timeout=self.timeout_seconds + 10) as response:
                result = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            raise LomographyClientError(
                f"FlareSolverr returned HTTP {exc.code}", status=exc.code
            ) from exc
        except urllib.error.URLError as exc:
            raise LomographyClientError(
                f"FlareSolverr is unavailable at {self.endpoint}: {exc.reason}"
            ) from exc
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise LomographyClientError("FlareSolverr returned an invalid response") from exc

        if result.get("status") != "ok":
            message = result.get("message") or "unknown FlareSolverr error"
            raise LomographyClientError(f"FlareSolverr failed: {message}")

        return result

    @staticmethod
    def _is_missing_session_error(message: str) -> bool:
        lowered = message.lower()
        return "session" in lowered and (
            "does not exist" in lowered or "doesn't exist" in lowered or "not found" in lowered
        )

    @staticmethod
    def _validate_page(html: str, status: int) -> None:
        challenge_markers = (
            "<title>Just a moment...</title>",
            "cf-mitigated",
            "Performing security verification",
        )
        if any(marker in html for marker in challenge_markers):
            raise LomographyClientError("Cloudflare challenge was not solved", status=status)
        if not html.strip():
            raise LomographyClientError("Lomography returned an empty page", status=status)
