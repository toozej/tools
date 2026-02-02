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
        credits = self._parse_credits(credits_content)

        return {
            "name": app_name,
            "title": title,
            "description": description,
            "tags": tags,
            "url": f"/{app_name}",
            "credits": credits,
            "has_credits": len(credits) > 0,
        }

    def _extract_title(self, readme_content: str, fallback: str) -> str:
        """Extract title from README.md (first H1 heading)."""
        # Look for first # heading
        match = re.search(r"^#\s+(.+)$", readme_content, re.MULTILINE)
        if match:
            return match.group(1).strip()

        # Fallback to app name, formatted nicely
        return fallback.replace("-", " ").replace("_", " ").title()

    def _extract_description(self, readme_content: str) -> str:
        """Extract description from README.md."""
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
                description = match.group(1).strip()
                # Clean up markdown formatting
                description = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", description)
                description = re.sub(r"[*_]{1,2}([^*_]+)[*_]{1,2}", r"\1", description)
                description = re.sub(r"`([^`]+)`", r"\1", description)
                # Normalize whitespace
                description = " ".join(description.split())
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

            # Clean up markdown formatting
            description = para
            description = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", description)
            description = re.sub(r"[*_]{1,2}([^*_]+)[*_]{1,2}", r"\1", description)
            description = re.sub(r"`([^`]+)`", r"\1", description)

            return description.strip()

        return "No description available."

    def _extract_tags(self, readme_content: str) -> list[str]:
        """Extract tags from README.md."""
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

        # Limit to first 10 tags
        return tags[:10]

    def _parse_credits(self, credits_content: str) -> list[dict]:
        """Parse CREDITS.md and extract credit entries with links."""
        if not credits_content.strip():
            return []

        credits = []

        # Split by headings or bullet points
        sections = re.split(r"\n(?=##\s+|\*\s+|-\s+)", credits_content)

        for section in sections:
            section = section.strip()
            if not section:
                continue

            # Extract heading if present
            heading_match = re.match(r"##\s+(.+)", section)
            if heading_match:
                category = heading_match.group(1).strip()
                content = section[len(heading_match.group(0)) :].strip()
            else:
                category = None
                content = section

            # Extract credit entries (bullet points or lines with links)
            # Look for patterns like: "- [Name](url) - description" or "- Name: description [link](url)"
            entry_patterns = [
                r"[-*]\s*\[([^\]]+)\]\(([^\)]+)\)(?:\s*[-:]\s*(.+))?",  # - [Name](url) - desc
                r"[-*]\s*(.+?):\s*(.+?)\s*\[([^\]]+)\]\(([^\)]+)\)",  # - Name: desc [link](url)
                r"[-*]\s*(.+?):\s*(.+)",  # - Name: desc (no link)
            ]

            for pattern in entry_patterns:
                matches = re.finditer(pattern, content, re.MULTILINE)
                for match in matches:
                    if len(match.groups()) == 4:  # Second pattern
                        name, desc, link_text, url = match.groups()
                        credit_entry = {
                            "name": name.strip(),
                            "description": desc.strip(),
                            "url": url.strip(),
                        }
                    elif len(match.groups()) >= 2 and match.group(2).startswith(
                        "http"
                    ):  # First pattern
                        name, url = match.group(1), match.group(2)
                        desc = match.group(3) if len(match.groups()) > 2 and match.group(3) else ""
                        credit_entry = {
                            "name": name.strip(),
                            "description": desc.strip() if desc else "",
                            "url": url.strip(),
                        }
                    else:  # Third pattern (no link)
                        credit_entry = {
                            "name": match.group(1).strip(),
                            "description": match.group(2).strip()
                            if len(match.groups()) > 1
                            else "",
                            "url": "",
                        }

                    if category:
                        credit_entry["category"] = category

                    credits.append(credit_entry)

        return credits

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
