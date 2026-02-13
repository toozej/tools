#!/usr/bin/env python3
"""
Tool management script for the tools repository.
Manages creation, removal, and copying of apps with Docker configuration.
"""

import argparse
import re
import shutil
import sys
import tempfile
from pathlib import Path

import git


class ToolsManager:
    """Manager for tools repository operations."""

    def __init__(self, repo_root: Path):
        """Initialize the manager with repository root path."""
        self.repo_root = repo_root
        self.templates_dir = self.repo_root / "templates"
        self.docker_compose_path = self.repo_root / "docker-compose.yml"
        self.apps_dir = self.repo_root / "apps"

    def new_tool(self, name: str, language: str, server: bool = False) -> None:
        """Create a new empty tool with template files."""
        print(f"Creating new tool: {name} in language {language}")

        app_dir = self.apps_dir / name
        if app_dir.exists():
            print(f"Error: Tool '{name}' already exists", file=sys.stderr)
            sys.exit(1)

        # Determine app_type
        if language == "js":
            app_type = "server" if server else "static"
            print(f"Selected {app_type} template for new JS app")
        else:
            app_type = "static"

        # Create app directory
        app_dir.mkdir(parents=True)
        print(f"Created directory: {app_dir}")

        # Copy template files
        self._copy_template_files(app_dir, language, app_type)

        print(f"Successfully created tool: {name}")

    def remove_tool(self, name: str, force: bool = False) -> None:
        """Remove a tool and its Docker service."""
        print(f"Removing tool: {name}")

        app_dir = self.apps_dir / name
        if not app_dir.exists():
            print(f"Error: Tool '{name}' does not exist", file=sys.stderr)
            sys.exit(1)

        # Confirm removal unless force flag is set
        if not force:
            response = input(f"Are you sure you want to remove '{name}'? [y/N]: ")
            if response.lower() not in ["y", "yes"]:
                print("Removal cancelled")
                return

        # Remove directory
        shutil.rmtree(app_dir)
        print(f"Removed directory: {app_dir}")

        print(f"Successfully removed tool: {name}")

    def copy_tool(self, name: str, git_url: str, repo_path: str = "") -> None:
        """Copy a tool from a git repository."""
        # Parse and extract actual git URL
        actual_git_url = self._parse_git_url(git_url)

        # Check for simonw/tools special case
        if self._is_simonw_tools_repo(actual_git_url):
            self._copy_from_simonw_tools(name, repo_path)
            return

        print(f"Copying tool '{name}' from: {actual_git_url}")

        app_dir = self.apps_dir / name
        if app_dir.exists():
            print(f"Error: Tool '{name}' already exists", file=sys.stderr)
            sys.exit(1)

        # Create temporary directory for cloning
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            print("Cloning repository to temporary directory...")

            try:
                # Clone repository
                git.Repo.clone_from(actual_git_url, temp_path)
                print("Successfully cloned repository")

                # Determine source path
                if repo_path:
                    source_path = temp_path / repo_path
                    if not source_path.exists():
                        print(
                            f"Error: Path '{repo_path}' not found in repository",
                            file=sys.stderr,
                        )
                        sys.exit(1)
                else:
                    source_path = temp_path

                # Create app directory
                app_dir.mkdir(parents=True)

                # Copy non-git files from source to app directory
                self._copy_non_git_files(source_path, app_dir)
                print(f"Copied files to: {app_dir}")

                # Copy template files
                app_language = self._detect_language(app_dir)
                self._copy_template_files(app_dir, app_language)

                # Determine app_type for service config
                if app_language == "js":
                    app_type = self._detect_app_type(app_dir)
                else:
                    app_type = "static"

                # Validate next.config.ts for JS apps
                if app_language == "js":
                    validated = self._validate_next_config(name, app_type)

                if validated:
                    print(f"Successfully copied tool: {name}")
                else:
                    print(
                        f"Successfully copied tool: {name} but next.config.ts was not properly configured. Requires manual verification"
                    )

            except git.GitCommandError as e:
                print(f"Error cloning repository: {e}", file=sys.stderr)
                sys.exit(1)

    def _detect_language(self, app_dir: Path) -> str:
        if len(list(app_dir.rglob("*.go"))) != 0:
            return "go"
        if (
            len(list(app_dir.rglob("*.ts"))) != 0
            or (app_dir / "package.json").exists()
            or (app_dir / "next.config.ts").exists()
            or (app_dir / "next.config.js").exists()
        ):
            return "js"
        if len(list(app_dir.rglob("*.html"))) != 0 or len(list(app_dir.rglob("*.htm"))) != 0:
            return "html"
        return "unknown"

    def _detect_app_type(self, app_dir: Path) -> str:
        """Detect if JS app needs server runtime or can be static."""
        # Check for API routes
        api_dirs = [
            app_dir / "src" / "app" / "api",
            app_dir / "pages" / "api",
            app_dir / "app" / "api",
        ]
        for api_dir in api_dirs:
            if api_dir.exists() and (any(api_dir.rglob("*.ts")) or any(api_dir.rglob("*.js"))):
                return "server"

        # Check for server-side patterns in source files
        server_patterns = [
            "next-auth",
            "getServerSideProps",
            "getInitialProps",
            "unstable_getServerSession",
        ]

        for ts_file in app_dir.rglob("*.ts"):
            try:
                content = ts_file.read_text()
                for pattern in server_patterns:
                    if pattern in content:
                        return "server"
            except Exception:
                pass

        for tsx_file in app_dir.rglob("*.tsx"):
            try:
                content = tsx_file.read_text()
                for pattern in server_patterns:
                    if pattern in content:
                        return "server"
            except Exception:
                pass

        return "static"

    def _validate_next_config(self, name: str, app_type: str) -> bool:
        """Validate next.config.ts for copy mode."""
        config_path = self.apps_dir / name / "next.config.ts"
        if not config_path.exists():
            expected_fields = ["basePath"]
            if app_type == "static":
                expected_fields.extend(["assetPrefix", "output"])
            else:
                expected_fields.append("output")
            print(
                f"Error: next.config.ts not found at {config_path}. Expected fields: {', '.join(expected_fields)}.",
                file=sys.stderr,
            )
            sys.exit(1)

        with open(config_path, encoding="utf-8") as f:
            content = f.read()

        modified = False

        # Always set basePath
        base_path_value = f"'/{name}'"
        if re.search(r"basePath\s*:\s*[^,]+", content):
            content, count = re.subn(r"(basePath\s*:\s*)[^,]+", rf"\1{base_path_value}", content)
            if count > 0:
                modified = True

        # Set output
        if app_type == "static":
            output_value = "'export'"
        else:
            output_value = "'standalone'"
        if re.search(r"output\s*:\s*[^,]+", content):
            content, count = re.subn(r"(output\s*:\s*)[^,]+", rf"\1{output_value}", content)
            if count > 0:
                modified = True

        # For static, set assetPrefix
        if app_type == "static":
            asset_prefix_value = f"'/{name}'"
            if re.search(r"assetPrefix\s*:\s*[^,]+", content):
                content, count = re.subn(
                    r"(assetPrefix\s*:\s*)[^,]+", rf"\1{asset_prefix_value}", content
                )
                if count > 0:
                    modified = True

        return modified

    def _copy_template_files(
        self, dest_dir: Path, app_language: str, app_type: str | None = None
    ) -> None:
        """Copy template files to destination directory."""
        if not self.templates_dir.exists():
            print(f"Warning: Templates directory not found at {self.templates_dir}")
            return

        template_files = {
            "all": {
                "README.md": "README.md",
                "app.env": "app.env",
            },
            "dockerignore": {
                "go": ".dockerignore.go",
                "js": ".dockerignore.js",
                "html": ".dockerignore.html",
            },
            "dockerfile": {
                "go": "Dockerfile.go",
                "js-static": "Dockerfile.js.static",
                "js-server": "Dockerfile.js.server",
                "html": "Dockerfile.html",
            },
        }

        # Determine app_type for JS
        if app_language == "js" and app_type is None:
            app_type = self._detect_app_type(dest_dir)
            print(f"Detected app type: {app_type} for JS app")

        # common files
        for template_name, dest_name in template_files["all"].items():
            template_path = self.templates_dir / template_name
            if template_path.exists():
                dest_path = dest_dir / dest_name
                shutil.copy2(template_path, dest_path)
                print(f"  Copied: {dest_name}")
            else:
                print(f"  Warning: Template '{template_name}' not found")

        # Copy language-specific .dockerignore
        dockerignore_templates = template_files["dockerignore"]
        if app_language in dockerignore_templates:
            template_path = self.templates_dir / dockerignore_templates[app_language]
            if template_path.exists():
                dest_path = dest_dir / ".dockerignore"
                shutil.copy2(template_path, dest_path)
                print(f"Copied: .dockerignore for {app_language}")
            else:
                print(f"Warning: Template '{dockerignore_templates[app_language]}' not found")

        # Copy language-specific Dockerfile
        dockerfile_templates = template_files["dockerfile"]
        if app_language == "go" and "go" in dockerfile_templates:
            template_path = self.templates_dir / dockerfile_templates["go"]
            if template_path.exists():
                dest_path = dest_dir / "Dockerfile"
                shutil.copy2(template_path, dest_path)
                print("Copied: Dockerfile.go")
            else:
                print("Warning: Template 'Dockerfile.go' not found")
        elif app_language == "js" and app_type in ["static", "server"]:
            template_key = f"js-{app_type}"
            if template_key in dockerfile_templates:
                template_path = self.templates_dir / dockerfile_templates[template_key]
                if template_path.exists():
                    dest_path = dest_dir / "Dockerfile"
                    shutil.copy2(template_path, dest_path)
                    print(f"  Copied: {dockerfile_templates[template_key]} as Dockerfile.js")
                else:
                    print(f"  Warning: Template '{dockerfile_templates[template_key]}' not found")
        elif app_language == "html" and "html" in dockerfile_templates:
            template_path = self.templates_dir / dockerfile_templates["html"]
            if template_path.exists():
                dest_path = dest_dir / "Dockerfile"
                shutil.copy2(template_path, dest_path)
                print("Copied: Dockerfile.html")
            else:
                print("Warning: Template 'Dockerfile.html' not found")

    def _copy_non_git_files(self, source: Path, dest: Path) -> None:
        """Copy all files except .git directory from source to destination."""
        # Handle both files and directories
        if source.is_file():
            # Copy single file
            if ".git" in source.parts:
                return
            dest_path = dest / source.name
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, dest_path)
            print(f"  Copied: {source.name}")
            return

        # Handle directory
        for item in source.rglob("*"):
            # Skip .git directory
            if ".git" in item.parts:
                continue

            # Calculate relative path
            rel_path = item.relative_to(source)
            dest_path = dest / rel_path

            if item.is_file():
                dest_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(item, dest_path)

    def _parse_git_url(self, input_url: str) -> str:
        """
        Parse git URL from either standard format or kilocode app builder format.

        Standard format: https://github.com/user/repo.git
        Kilocode format: git clone https://x-access-token:TOKEN@builder.kiloapps.io/apps/UUID.git

        Returns the actual git URL to use for cloning.
        """
        # Check if this is a kilocode app builder clone command
        if input_url.strip().startswith("git clone "):
            # Extract the URL after "git clone "
            url = input_url.strip()[10:].strip()
            print("Detected kilocode app builder URL")
            return url

        # Otherwise, assume it's a standard git URL
        return input_url.strip()

    def _is_simonw_tools_repo(self, git_url: str) -> bool:
        """Check if the git URL is for simonw/tools repository."""
        # Various URL formats to check
        patterns = [
            r"https://github\.com/simonw/tools(\.git)?$",
            r"github\.com/simonw/tools(\.git)?$",
            r"^simonw/tools(\.git)?$",
        ]
        for pattern in patterns:
            if re.match(pattern, git_url):
                return True
        return False

    def _copy_from_simonw_tools(self, name: str, repo_path: str) -> None:
        """Copy a tool from the local simonw/tools clone or clone if needed."""
        simonw_tools_path = self.repo_root / "tmp" / "github" / "simonw" / "tools"

        # 1. Check for locally cloned repo
        if not simonw_tools_path.exists():
            print("Cloning simonw/tools to local cache...")
            simonw_tools_path.parent.mkdir(parents=True, exist_ok=True)
            try:
                git.Repo.clone_from("https://github.com/simonw/tools.git", simonw_tools_path)
                print(f"Successfully cloned simonw/tools to {simonw_tools_path}")
            except git.GitCommandError as e:
                print(f"Error cloning simonw/tools: {e}", file=sys.stderr)
                sys.exit(1)
        else:
            print(f"Using existing local clone at {simonw_tools_path}")

        # 2. Check for repo_path
        if not repo_path:
            print("Error: --path flag is required for copying from simonw/tools", file=sys.stderr)
            sys.exit(1)

        source_path = simonw_tools_path / repo_path
        if not source_path.exists():
            print(f"Error: Path '{repo_path}' not found in simonw/tools", file=sys.stderr)
            sys.exit(1)

        # 3. Create app directory
        app_dir = self.apps_dir / name
        if app_dir.exists():
            print(f"Error: Tool '{name}' already exists", file=sys.stderr)
            sys.exit(1)

        app_dir.mkdir(parents=True)
        print(f"Created directory: {app_dir}")

        # 4. Copy files from source
        print(f"Copying files from {source_path} to {app_dir}")
        self._copy_non_git_files(source_path, app_dir)

        # 5. Rename HTML file to index.html if present
        html_file = app_dir / f"{name}.html"
        if html_file.exists():
            index_file = app_dir / "index.html"
            html_file.rename(index_file)
            print(f"Renamed {name}.html to index.html")

        # 6. Copy Apache 2.0 license from repo root
        self._copy_license(app_dir)

        # 7. Copy template files
        app_language = self._detect_language(app_dir)
        print(f"Detected language: {app_language}")
        self._copy_template_files(app_dir, app_language)

        # 8. Copy documentation and add credit
        self._copy_simonw_docs(repo_path, app_dir, name)

        # 9. For JS apps, detect app type and validate next.config.ts
        if app_language == "js":
            app_type = self._detect_app_type(app_dir)
            print(f"Detected app type: {app_type}")
            validated = self._validate_next_config(name, app_type)

        if validated:
            print(f"Successfully copied tool: {name} from simonw/tools")
        else:
            print(f"Copying tool: {name} from simonw/tools failed")

    def _copy_simonw_docs(self, repo_path: str, app_dir: Path, name: str) -> None:
        """Copy documentation from simonw/tools and add credit header."""
        # Extract app name from repo_path (strip .html if present)
        app_name = Path(repo_path).stem
        if app_name.endswith(".html"):
            app_name = app_name[:-5]

        docs_filename = f"{app_name}.docs.md"
        simonw_tools_path = self.repo_root / "tmp" / "github" / "simonw" / "tools"
        docs_source = simonw_tools_path / docs_filename
        readme_path = app_dir / "README.md"

        # Build the source URL for credit
        source_url = f"https://github.com/simonw/tools/blob/main/{repo_path}"

        if docs_source.exists():
            # Read existing docs
            existing_content = docs_source.read_text()
            # Create new README with credit header
            new_content = f"# {name}\n\nFrom {source_url}\n\n{existing_content}"
            readme_path.write_text(new_content)
            print(f"Copied documentation from {docs_filename} to README.md with credit")
        else:
            print(f"Warning: Documentation file '{docs_filename}' not found in simonw/tools")
            # Create minimal README with credit
            new_content = f"# {name}\n\nFrom {source_url}\n"
            readme_path.write_text(new_content)
            print("Created README.md with credit header only")

    def _copy_license(self, app_dir: Path) -> None:
        """Copy Apache 2.0 license to the app directory."""
        license_source = self.repo_root / "LICENSE"
        license_dest = app_dir / "LICENSE"

        if license_source.exists():
            shutil.copy2(license_source, license_dest)
            print(f"Copied LICENSE to {app_dir.name}")
        else:
            print(f"Warning: LICENSE file not found at {license_source}")


def main():
    """Main entry point for the manage script."""
    parser = argparse.ArgumentParser(
        description="Manage tools in the repository",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s new my-app
  %(prog)s copy my-app https://github.com/user/repo.git path/to/app
  %(prog)s remove my-app
  %(prog)s remove my-app --force
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    subparsers.required = True

    # New command
    new_parser = subparsers.add_parser("new", help="Create a new empty app")
    new_parser.add_argument("name", help="Name of the app to create")
    new_parser.add_argument("language", help="Programming language of the app")
    new_parser.add_argument(
        "--server", action="store_true", help="Force server template for JS apps"
    )

    # Copy command
    copy_parser = subparsers.add_parser("copy", help="Copy an app from a git repository")
    copy_parser.add_argument("name", help="Name of the app to create")
    copy_parser.add_argument("git_url", help="Git repository URL")
    copy_parser.add_argument("--path", default="", help="Path within the repository (optional)")

    # Remove command
    remove_parser = subparsers.add_parser("remove", help="Remove an app")
    remove_parser.add_argument("name", help="Name of the app to remove")
    remove_parser.add_argument(
        "-f", "--force", action="store_true", help="Remove without confirmation"
    )

    args = parser.parse_args()

    # Initialize manager
    git_repo = git.Repo(search_parent_directories=True)
    if git_repo.working_tree_dir is None:
        print("Error: Could not determine repository working tree directory", file=sys.stderr)
        sys.exit(1)
    assert git_repo.working_tree_dir is not None
    git_root = Path(git_repo.working_tree_dir)
    manager = ToolsManager(git_root)

    # Execute command
    try:
        if args.command == "new":
            manager.new_tool(args.name, args.language, args.server)
        elif args.command == "copy":
            manager.copy_tool(args.name, args.git_url, args.path)
        elif args.command == "remove":
            manager.remove_tool(args.name, args.force)
    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
