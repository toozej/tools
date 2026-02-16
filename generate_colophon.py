#!/usr/bin/env python3
"""
Generate a combined colophon from all app README.md and CREDITS.md files.
Creates a JSON file suitable for ingestion by a NextJS homepage application.
"""

import argparse
import json
import re
import sys
from pathlib import Path


class ColophonGenerator:
    """Generator for combined colophon from app documentation."""

    def __init__(self, repo_root: Path | None = None, output_path: Path | None = None):
        """Initialize the generator with repository root path."""
        self.repo_root = repo_root or Path.cwd()
        self.output_path = output_path or self.repo_root / "colophon.json"

        # Directories to exclude from app scanning
        self.exclude_dirs = {
            "templates",
            "nginx",
            ".git",
            "__pycache__",
            "node_modules",
            ".venv",
            "venv",
        }

    def generate(self) -> None:
        """Generate the combined colophon file."""
        print(f"Scanning repository: {self.repo_root}")

        apps = self._discover_apps()
        print(f"Found {len(apps)} apps")

        colophon_data = []

        for app_name in sorted(apps):
            app_dir = self.repo_root / "apps" / app_name
            app_info = self._extract_app_info(app_name, app_dir)

            if app_info:
                colophon_data.append(app_info)
                print(f"  ✓ Processed: {app_name}")
            else:
                print(f"  ⚠ Skipped: {app_name} (missing README.md)")

        # Write output
        output_data = {
            "generated_at": self._get_timestamp(),
            "total_apps": len(colophon_data),
            "apps": colophon_data,
        }

        with open(self.output_path, "w", encoding="utf-8") as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)

        print(f"\n✓ Generated colophon: {self.output_path}")
        print(f"  Total apps: {len(colophon_data)}")

    def _discover_apps(self) -> list[str]:
        """Discover all app directories in the repository."""
        apps = []

        # Look in the apps/ subdirectory
        apps_dir = self.repo_root / "apps"
        if not apps_dir.exists():
            return apps

        for item in apps_dir.iterdir():
            # Skip if not a directory
            if not item.is_dir():
                continue

            # Skip excluded directories
            if item.name in self.exclude_dirs or item.name.startswith("."):
                continue

            # Check if it has a Dockerfile (indicating it's an app)
            if (item / "Dockerfile").exists() or (item / "README.md").exists():
                apps.append(item.name)

        return apps

    def _extract_app_info(self, app_name: str, app_dir: Path) -> dict | None:
        """Extract information from an app's README.md and CREDITS.md."""
        readme_path = app_dir / "README.md"
        credits_path = app_dir / "CREDITS.md"

        # README.md is required
        if not readme_path.exists():
            return None

        # Read README
        with open(readme_path, encoding="utf-8") as f:
            readme_content = f.read()

        # Read CREDITS if it exists
        credits_content = ""
        if credits_path.exists():
            with open(credits_path, encoding="utf-8") as f:
                credits_content = f.read()

        # Extract information
        title = self._extract_title(readme_content, app_name)
        description = self._extract_description(readme_content)
        tags = self._extract_tags(readme_content)
        author = self._extract_author(credits_content, readme_content)
        credits = self._parse_credits(credits_content, readme_content)

        app_info = {
            "name": app_name,
            "title": title,
            "description": description,
            "tags": tags,
            "url": f"/{app_name}",
            "credits": credits,
            "has_credits": len(credits) > 0,
        }
        if author:
            app_info["author"] = author

        return app_info

    def _extract_title(self, readme_content: str, fallback: str) -> str:
        """Extract title from README.md (first H1 heading)."""
        # Look for first # heading
        match = re.search(r"^#\s+(.+)$", readme_content, re.MULTILINE)
        if match:
            return match.group(1).strip()

        # Fallback to app name, formatted nicely
        return fallback.replace("-", " ").replace("_", " ").title()

    def _clean_description(self, text: str) -> str:
        """Remove Markdown formatting and emojis from text, converting lists to sentences."""
        text = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", text)
        text = re.sub(r"[*_]{1,2}([^*_]+)[*_]{1,2}", r"\1", text)
        text = re.sub(r"`([^`]+)`", r"\1", text)
        text = re.sub(r"^#+\s+.*$", "", text, flags=re.MULTILINE)
        text = re.sub(
            r"[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF"
            r"\U0001F1E0-\U0001F1FF\U00002702-\U000027B0\U000024C2-\U0001F251"
            r"\U0001F900-\U0001F9FF\U0001FA00-\U0001FA6F\U0001FA70-\U0001FAFF]",
            "",
            text,
        )

        def capitalize_after_marker(match: re.Match) -> str:
            return match.group(1).upper()

        text = re.sub(r"^\s*[-*]\s+([A-Za-z])", capitalize_after_marker, text)
        text = re.sub(r"\s*[-*]\s+([A-Za-z])", lambda m: f". {m.group(1).upper()}", text)

        text = " ".join(text.split())
        text = re.sub(r"\s*\.\s*\.\s*", ". ", text)
        text = text.strip()
        if text and not text[0].isupper():
            text = text[0].upper() + text[1:] if len(text) > 1 else text.upper()
        if text and not text.endswith("."):
            text += "."
        return text

    def _extract_description(self, readme_content: str) -> str:
        """Extract description from README.md."""
        # Handle special case for apps copied from simonw/tools
        # Format: "# Title\n\nFrom <url>\n\nDescription here\n\n<!-- Generated... -->"
        lines = readme_content.split("\n")
        if len(lines) >= 5 and lines[2].strip().startswith("From https://github.com/simonw/tools"):
            # Description is on line 4 (index 4) for simonw/tools format
            description = lines[4].strip()
            if description:
                description = self._clean_description(description)
                return description if description else "No description available."

        # Remove the title (first H1)
        content = re.sub(r"^#\s+.+$", "", readme_content, count=1, flags=re.MULTILINE)

        # Look for text after common description headings
        desc_patterns = [
            r"##\s+(?:Project Purpose|Description|Overview|About)\s*\n+(.+?)(?=\n##|\Z)",
            r"##\s+.+?\s*\n+(.+?)(?=\n##|\Z)",  # First section content after any H2
        ]

        for pattern in desc_patterns:
            match = re.search(pattern, content, re.IGNORECASE | re.DOTALL)
            if match:
                description = self._clean_description(match.group(1).strip())
                if description:
                    return description

        # Fallback: Extract first paragraph after title
        paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]

        for para in paragraphs:
            # Skip if it's a heading
            if para.startswith("#"):
                continue
            # Skip if it's a horizontal rule
            if para.startswith("---") or para.startswith("***"):
                continue
            # Skip if it's just a link or image
            if para.startswith("[") or para.startswith("!"):
                continue

            return self._clean_description(para)

        return "No description available."

    # Technology patterns for tag extraction: (regex pattern -> canonical tag name)
    # Order matters: more specific patterns should come before general ones
    TECH_PATTERNS = [
        # Web frameworks
        (r"next\.js\s*19?", "Next.js"),
        (r"react\s*19?", "React"),
        (r"tailwind\s*css\s*v?4", "Tailwind CSS"),
        (r"tailwind\s*css", "Tailwind CSS"),
        # Languages
        (r"typescript", "TypeScript"),
        (r"golang|\bgo\b", "Go"),
        # Platforms/Tools
        (r"docker", "Docker"),
        (r"oauth\s*2?", "OAuth"),
        (r"github\s*api", "GitHub API"),
        (r"\bbun\b", "Bun"),
        (r"node\.js", "Node.js"),
        # Processing/Conversion
        (r"optical\s*character\s*recognition|ocr", "OCR"),
        (r"tesseract", "Tesseract"),
        (r"pdf\.js", "PDF.js"),
        (r"jsqr", "jsQR"),
        (r"readability", "Readability"),
        (r"speechsynthesis|tts", "SpeechSynthesis"),
        (r"graphviz", "Graphviz"),
        (r"\bdot\b", "DOT"),
        # Formats
        (r"markdown|gfm", "Markdown"),
        (r"epub", "EPUB"),
        (r"exif", "EXIF"),
        (r"qr\s*code", "QR"),
        (r"yaml", "YAML"),
        (r"json", "JSON"),
        (r"webassembly|wasm", "WebAssembly"),
    ]

    def _extract_tags(self, readme_content: str) -> list[str]:
        """Extract tags from README.md using data-driven pattern matching."""
        tags = []

        # Look for a Tags or Keywords section
        tags_section = re.search(
            r"##\s+(Tags|Keywords|Categories)[\s:]*\n(.+?)(?=\n##|\Z)",
            readme_content,
            re.IGNORECASE | re.DOTALL,
        )

        if tags_section:
            tags_text = tags_section.group(2)
            # Extract from comma-separated list or bullet points
            tag_matches = re.findall(r"[-*]\s*(.+)|([^,\n]+)", tags_text)
            for match in tag_matches:
                tag = (match[0] or match[1]).strip()
                if tag and not tag.startswith("#"):
                    tags.append(tag)

        # Also look for badges/shields that might indicate technology
        badge_matches = re.findall(r"!\[([^\]]+)\]", readme_content)
        for badge in badge_matches:
            if badge and badge not in tags:
                tags.append(badge)

        # Extract technology tags using pattern matching
        content_lower = readme_content.lower()
        for pattern, canonical_tag in self.TECH_PATTERNS:
            if re.search(pattern, content_lower, re.IGNORECASE):
                if canonical_tag not in tags:
                    tags.append(canonical_tag)

        # Normalize tags: lowercase, trimmed, deduped
        normalized_tags = []
        seen = set()
        for tag in tags:
            tag_normalized = tag.strip().lower()
            if tag_normalized and tag_normalized not in seen:
                seen.add(tag_normalized)
                # Title case for display
                tag_title = tag_normalized.title()
                normalized_tags.append(tag_title)

        return normalized_tags[:10]

    def _extract_github_usernames(self, text: str) -> list[dict]:
        """Extract GitHub usernames/links from text content.

        Matches patterns like:
        - https://github.com/<user>/<repo>
        - https://github.com/<user>/<repo>/...
        - https://www.github.com/<user>/<repo>
        - [text](https://github.com/<user>/<repo>)

        Returns a list of dicts with 'name' (username) and 'url' (full link).
        """
        github_patterns = [
            # Markdown links: [text](https://github.com/user/repo)
            r"\[([^\]]+)\]\((?:https?://)?(?:www\.)?github\.com/([^/]+)/[^)]+\)",
            # Bare URLs: https://github.com/user/repo or www.github.com/user/repo
            r"(?:https?://)?(?:www\.)?github\.com/([^/]+)/[^\s\)\]<>]+",
        ]

        usernames = []
        seen = set()

        for pattern in github_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                # Extract username (second group for markdown links, first for bare URLs)
                if len(match.groups()) >= 2:
                    username = match.group(2).strip()
                else:
                    username = match.group(1).strip()

                # Clean username (remove trailing slashes, etc.)
                username = username.rstrip("/")

                if username and username not in seen:
                    seen.add(username)
                    # Reconstruct the full GitHub URL
                    full_url = f"https://github.com/{username}"
                    usernames.append({"name": username, "url": full_url})

        return usernames

    def _extract_author(self, credits_content: str, readme_content: str = "") -> dict | None:
        """Extract author from CREDITS.md Author section, or fall back to README.md.

        Returns a dict with 'name' and optionally 'url', or None if not found.
        """
        # First, look for Author section in CREDITS.md
        if credits_content.strip():
            author_match = re.search(
                r"##\s+Authors?\s*\n+(.+?)(?=\n##|\Z)",
                credits_content,
                re.IGNORECASE | re.DOTALL,
            )
            if author_match:
                author_section = author_match.group(1).strip()
                author = self._parse_author_content(author_section)
                if author:
                    return author

            # Also check for author patterns in CREDITS.md content (even without Author section)
            author = self._parse_author_content(credits_content)
            if author:
                return author

        # Fallback: extract GitHub usernames from README
        if readme_content:
            github_users = self._extract_github_usernames(readme_content)
            if github_users:
                # Return the first one as the primary author
                return github_users[0]

        return None

    def _parse_author_content(self, content: str) -> dict | None:
        """Parse author content to extract name and URL."""
        # Look for markdown link pattern: [name](url)
        link_match = re.search(r"\[([^\]]+)\]\((https?://[^\)]+)\)", content)
        if link_match:
            return {
                "name": link_match.group(1).strip(),
                "url": link_match.group(2).strip(),
            }

        # Look for GitHub URL pattern
        github_match = re.search(
            r"(?:https?://)?(?:www\.)?github\.com/([^/\s\)]+)",
            content,
            re.IGNORECASE,
        )
        if github_match:
            username = github_match.group(1).strip().rstrip("/")
            return {"name": username, "url": f"https://github.com/{username}"}

        # Fallback: just use the first line as author name
        first_line = content.split("\n")[0].strip()
        # Clean up common prefixes
        first_line = re.sub(
            r"^(Created (by|with\s+\S+\s+by)|Written by|Author:?)\s*",
            "",
            first_line,
            flags=re.IGNORECASE,
        )
        if first_line:
            return {"name": first_line}

        return None

    def _parse_credits(self, credits_content: str, readme_content: str = "") -> list[dict]:
        """Parse CREDITS.md and extract credit entries with links.

        Falls back to README.md if CREDITS.md is empty or not present.
        """
        credits = []

        # First try CREDITS.md if it has content
        if credits_content.strip():
            credits = self._parse_credits_content(credits_content)

        # If no credits found, try extracting from README.md
        if not credits and readme_content:
            github_users = self._extract_github_usernames(readme_content)
            if github_users:
                credits = github_users

        return credits

    def _parse_credits_content(self, content: str) -> list[dict]:
        """Parse credit content (from CREDITS.md or similar)."""
        if not content.strip():
            return []

        credits = []
        matched_lines = set()

        sections = re.split(r"\n(?=##\s+)", content)

        for section in sections:
            section = section.strip()
            if not section:
                continue

            heading_match = re.match(r"##\s+(.+)", section)
            if heading_match:
                category = heading_match.group(1).strip()
                content_body = section[len(heading_match.group(0)) :].strip()
            else:
                category = None
                content_body = section

            multiline_credits = self._parse_multiline_credits(content_body, category)
            if multiline_credits:
                for c in multiline_credits:
                    line_key = f"{c.get('name', '')}|{c.get('url', '')}"
                    if line_key not in matched_lines:
                        credits.append(c)
                        matched_lines.add(line_key)
                continue

            lines = content_body.split("\n")
            for line in lines:
                line_stripped = line.strip()
                if not line_stripped or line_stripped.startswith("#"):
                    continue

                line_key = line_stripped
                if line_key in matched_lines:
                    continue

                credit_entry = self._parse_single_credit_line(line_stripped)
                if credit_entry:
                    if category:
                        credit_entry["category"] = category
                    credits.append(credit_entry)
                    matched_lines.add(line_key)

        return credits

    def _parse_multiline_credits(self, content: str, category: str | None) -> list[dict] | None:
        """Parse multi-line credit format where name and URL are on separate lines.

        Format:
        - Name
            - https://url
        """
        credits = []
        lines = content.split("\n")
        i = 0

        while i < len(lines):
            line = lines[i].strip()

            if not line or not line.startswith("-"):
                i += 1
                continue

            name_match = re.match(r"^[-*]\s+(.+)$", line)
            if not name_match:
                i += 1
                continue

            name = name_match.group(1).strip()

            if i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                url_match = re.match(r"^[-*]\s+(https?://[^\s]+)$", next_line)
                if url_match:
                    url = url_match.group(1).strip()
                    credit_entry = {"name": name, "url": url}
                    if category:
                        credit_entry["category"] = category
                    credits.append(credit_entry)
                    i += 2
                    continue

            i += 1

        return credits if credits else None

    def _parse_single_credit_line(self, line: str) -> dict | None:
        """Parse a single credit line and return a credit entry dict."""
        link_first = re.match(r"^[-*]\s*\[([^\]]+)\]\(([^\)]+)\)(?:\s*[-:–—]\s*(.+))?$", line)
        if link_first:
            name, url, desc = link_first.groups()
            return {
                "name": name.strip(),
                "url": url.strip(),
                "description": desc.strip() if desc else "",
            }

        link_embedded = re.match(r"^[-*]\s*(.+?)\s*\[([^\]]+)\]\(([^\)]+)\)\s*(.*)$", line)
        if link_embedded:
            prefix, name, url, suffix = link_embedded.groups()
            full_desc = f"{prefix.strip()} {name.strip()} {suffix.strip()}".strip()
            return {
                "name": name.strip(),
                "url": url.strip(),
                "description": full_desc,
            }

        link_last = re.match(r"^[-*]\s*(.+?)\s*[-:–—]\s*(.+?)\s*\[([^\]]+)\]\(([^\)]+)\)$", line)
        if link_last:
            name, desc, _, url = link_last.groups()
            return {
                "name": name.strip(),
                "description": desc.strip(),
                "url": url.strip(),
            }

        no_link = re.match(r"^[-*]\s*(.+?)\s*[-:–—]\s+(.+)$", line)
        if no_link:
            name, desc = no_link.groups()
            if "[" in name or "](" in name:
                return None
            if re.search(r"\b[eE]-\w", name):
                return None
            return {
                "name": name.strip(),
                "description": desc.strip(),
                "url": "",
            }

        return None

    def _get_timestamp(self) -> str:
        """Get current timestamp in ISO format."""
        from datetime import datetime, timezone

        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def main():
    """Main entry point for the generate_colophon script."""
    parser = argparse.ArgumentParser(
        description="Generate combined colophon from app documentation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s
  %(prog)s --output ./public/colophon.json
  %(prog)s --repo /path/to/tools/repo
        """,
    )

    parser.add_argument(
        "--repo",
        type=Path,
        help="Path to tools repository (default: current directory)",
    )

    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        help="Output path for colophon.json (default: colophon.json in repo root)",
    )

    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    args = parser.parse_args()

    try:
        generator = ColophonGenerator(repo_root=args.repo, output_path=args.output)
        generator.generate()
    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        if args.verbose:
            import traceback

            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
