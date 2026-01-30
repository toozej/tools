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
from typing import Optional

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

        # Add service to docker-compose.yml
        self._add_docker_service(name, app_type, language)

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

        # Remove service from docker-compose.yml
        self._remove_docker_service(name)

        print(f"Successfully removed tool: {name}")

    def copy_tool(self, name: str, git_url: str, repo_path: str = "") -> None:
        """Copy a tool from a git repository."""
        # Parse and extract actual git URL
        actual_git_url = self._parse_git_url(git_url)

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
                    self._validate_next_config(name, app_type)

                # Add service to docker-compose.yml
                self._add_docker_service(name, app_type, app_language)

                print(f"Successfully copied tool: {name}")

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
        if (
            len(list(app_dir.rglob("*.html"))) != 0
            or len(list(app_dir.rglob("*.htm"))) != 0
        ):
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

    def _validate_next_config(self, name: str, app_type: str) -> None:
        """Validate and auto-fix next.config.ts for copy mode."""
        config_path = self.apps_dir / name / "next.config.ts"
        if not config_path.exists():
            expected_fields = ["basePath"]
            if app_type == "static":
                expected_fields.extend(["assetPrefix", "output"])
            else:
                expected_fields.append("output")
            print(f"Error: next.config.ts not found at {config_path}. Expected fields: {', '.join(expected_fields)}.", file=sys.stderr)
            sys.exit(1)

        with open(config_path, 'r', encoding='utf-8') as f:
            content = f.read()

        lines = content.split('\n')
        modified = False

        # Always set basePath
        base_path_value = f"'/{name}'"
        if re.search(r'basePath\s*:\s*[^,]+', content):
            content, count = re.subn(r'(basePath\s*:\s*)[^,]+', rf'\1{base_path_value}', content)
            if count > 0:
                modified = True
        else:
            # Insert after the opening {
            for i, line in enumerate(lines):
                if '{' in line and ('NextConfig' in lines[i-1] if i > 0 else False):
                    indent = '  '
                    lines.insert(i + 1, f'{indent}basePath: {base_path_value},')
                    modified = True
                    break

        # Set output
        if app_type == 'static':
            output_value = "'export'"
        else:
            output_value = "'standalone'"
        if re.search(r'output\s*:\s*[^,]+', content):
            content, count = re.subn(r'(output\s*:\s*)[^,]+', rf'\1{output_value}', content)
            if count > 0:
                modified = True
        else:
            # Insert after basePath or after {
            inserted = False
            for i, line in enumerate(lines):
                if 'basePath:' in line:
                    lines.insert(i + 1, f'{line[:len(line) - len(line.lstrip())]}output: {output_value},')
                    modified = True
                    inserted = True
                    break
            if not inserted:
                for i, line in enumerate(lines):
                    if '{' in line and ('NextConfig' in lines[i-1] if i > 0 else False):
                        indent = '  '
                        lines.insert(i + 1, f'{indent}output: {output_value},')
                        modified = True
                        break

        # For static, set assetPrefix
        if app_type == 'static':
            asset_prefix_value = f"'/{name}'"
            if re.search(r'assetPrefix\s*:\s*[^,]+', content):
                content, count = re.subn(r'(assetPrefix\s*:\s*)[^,]+', rf'\1{asset_prefix_value}', content)
                if count > 0:
                    modified = True
            else:
                # Insert after basePath
                for i, line in enumerate(lines):
                    if 'basePath:' in line:
                        lines.insert(i + 1, f'{line[:len(line) - len(line.lstrip())]}assetPrefix: {asset_prefix_value},')
                        modified = True
                        break

        if modified:
            content = '\n'.join(lines)
            with open(config_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated next.config.ts for {name}")

    def _copy_template_files(self, dest_dir: Path, app_language: str, app_type: Optional[str] = None) -> None:
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
                print("Copied: .dockerignore for {app_language}")
            else:
                print("Warning: Template '{dockerignore_templates[app_language]}' not found")

        # Copy language-specific Dockerfile
        dockerfile_templates = template_files["dockerfile"]
        if app_language == "go" and "go" in dockerfile_templates:
            template_path = self.templates_dir / dockerfile_templates["go"]
            if template_path.exists():
                dest_path = dest_dir / "Dockerfile.go"
                shutil.copy2(template_path, dest_path)
                print("Copied: Dockerfile.go")
            else:
                print("Warning: Template 'Dockerfile.go' not found")
        elif app_language == "js" and app_type in ["static", "server"]:
            template_key = f"js-{app_type}"
            if template_key in dockerfile_templates:
                template_path = self.templates_dir / dockerfile_templates[template_key]
                if template_path.exists():
                    dest_path = dest_dir / "Dockerfile.js"
                    shutil.copy2(template_path, dest_path)
                    print(f"  Copied: {dockerfile_templates[template_key]} as Dockerfile.js")
                else:
                    print(f"  Warning: Template '{dockerfile_templates[template_key]}' not found")
        elif app_language == "html" and "html" in dockerfile_templates:
            template_path = self.templates_dir / dockerfile_templates["html"]
            if template_path.exists():
                dest_path = dest_dir / "Dockerfile.html"
                shutil.copy2(template_path, dest_path)
                print("Copied: Dockerfile.html")
            else:
                print("Warning: Template 'Dockerfile.html' not found")

    def _copy_non_git_files(self, source: Path, dest: Path) -> None:
        """Copy all files except .git directory from source to destination."""
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

    def _add_docker_service(self, name: str, app_type: str = "static", language: str = "unknown") -> None:
        """Add a service entry to docker-compose.yml."""
        if not self.docker_compose_path.exists():
            print(
                f"Error: docker-compose.yml not found at {self.docker_compose_path}",
                file=sys.stderr,
            )
            sys.exit(1)

        # Read existing content
        with open(self.docker_compose_path, "r") as f:
            content = f.read()

        # Generate service configuration
        service_config = self._generate_service_config(name, app_type, language)

        # Check if service already exists
        if f"  {name}:" in content:
            print(f"Warning: Service '{name}' already exists in docker-compose.yml")
            return

        # Find the services section and append new service
        if "services:" in content:
            # Insert before the end of the file
            lines = content.rstrip().split("\n")
            lines.append("")
            lines.extend(service_config.split("\n"))
            content = "\n".join(lines) + "\n"
        else:
            print(
                "Error: No 'services:' section found in docker-compose.yml",
                file=sys.stderr,
            )
            sys.exit(1)

        # Write updated content
        with open(self.docker_compose_path, "w", encoding="utf-8") as f:
            f.write(content)

        print(f"Added service '{name}' to docker-compose.yml")

        # Update nginx config based on app type
        if app_type == "static":
            self._add_nginx_volume(name)
        self._add_nginx_location(name, app_type)

    def _remove_docker_service(self, name: str) -> None:
        """Remove a service entry from docker-compose.yml."""
        if not self.docker_compose_path.exists():
            print("Warning: docker-compose.yml not found")
            return

        with open(self.docker_compose_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        # Find and remove service section
        new_lines = []
        skip = False
        service_indent = None

        for i, line in enumerate(lines):
            # Check if this is the start of our service
            if line.strip() == f"{name}:":
                skip = True
                service_indent = len(line) - len(line.lstrip())
                continue

            # If we're skipping, check if we've reached the next service
            if skip:
                current_indent = len(line) - len(line.lstrip())
                # Empty line or comment
                if not line.strip() or line.strip().startswith("#"):
                    continue
                # Next service at same indent level
                if current_indent <= service_indent and line.strip():
                    skip = False
                else:
                    continue

            new_lines.append(line)

        # Write updated content
        with open(self.docker_compose_path, "w", encoding="utf-8") as f:
            f.writelines(new_lines)

        print(f"Removed service '{name}' from docker-compose.yml")

        # Remove nginx volume mount and location
        self._remove_nginx_volume(name)
        self._remove_nginx_location(name)

    def _add_nginx_volume(self, name: str) -> None:
        """Add volume mount to nginx service for the app's build output."""
        with open(self.docker_compose_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        new_lines = []
        in_nginx = False
        in_volumes = False
        added = False

        for line in lines:
            # Check if we're in nginx service
            if line.strip() == "nginx:" or line.strip().startswith("nginx:"):
                in_nginx = True
            elif in_nginx and line.strip() and not line[0].isspace():
                in_nginx = False
                in_volumes = False

            # Check if we're in volumes section of nginx
            if in_nginx and line.strip() == "volumes:":
                in_volumes = True

            new_lines.append(line)

            # Add our volume mount after other volume entries
            if in_volumes and not added and line.strip().startswith("- "):
                # Check if this is the last volume entry by looking ahead
                continue_loop = False
                for next_line in lines[lines.index(line) + 1 :]:
                    if next_line.strip().startswith("- "):
                        continue_loop = True
                        break
                    elif next_line.strip() and not next_line[0].isspace():
                        break

                if not continue_loop:
                    volume_mount = (
                        f"      - build_output_{name}:/usr/share/nginx/html/{name}:ro\n"
                    )
                    new_lines.append(volume_mount)
                    added = True

        if not added:
            print("Warning: Could not add volume mount to nginx service")

        with open(self.docker_compose_path, "w", encoding="utf-8") as f:
            f.writelines(new_lines)

        print(f"Added volume mount for '{name}' to nginx service")

    def _remove_nginx_volume(self, name: str) -> None:
        """Remove volume mount from nginx service for the app's build output."""
        with open(self.docker_compose_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        new_lines = []
        volume_mount_pattern = f"build_output_{name}:/usr/share/nginx/html/{name}"

        for line in lines:
            if volume_mount_pattern not in line:
                new_lines.append(line)

        with open(self.docker_compose_path, "w", encoding="utf-8") as f:
            f.writelines(new_lines)

        print(f"Removed volume mount for '{name}' from nginx service")

    def _add_nginx_location(self, name: str, app_type: str = "static") -> None:
        """Add location block to nginx config for the app."""
        nginx_config_path = self.repo_root / "nginx" / "conf.d" / "default.conf"

        if not nginx_config_path.exists():
            print(f"Warning: nginx config not found at {nginx_config_path}")
            return

        with open(nginx_config_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Check if location already exists
        location_pattern = f"location ^~ /{name}"
        if location_pattern in content:
            print(f"Warning: Location '/{name}' already exists in nginx config")
            return

        # Generate location block based on app type
        if app_type == "static":
            location_block = f"""
    location ^~ /{name}/ {{
        alias /var/www/html/{name}/;
        try_files $uri $uri/ /{name}/index.html;
    }}
"""
        else:  # server
            location_block = f"""
    location ^~ /{name} {{
        proxy_pass http://{name}:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }}
"""

        # Find position to insert (before static asset caching block)
        insert_marker = "    # Static asset caching"
        if insert_marker in content:
            content = content.replace(insert_marker, location_block + insert_marker)
        else:
            # If marker not found, insert before closing brace
            content = content.rstrip().rstrip("}") + location_block + "}\n"

        # For static apps, add referer rule in /_next/ location
        if app_type == "static":
            next_location_start = "    location ^~ /_next/ {"
            if next_location_start in content:
                # Find the position after the last if statement in /_next/
                lines = content.split('\n')
                next_block_start = None
                last_if_line = -1
                for i, line in enumerate(lines):
                    if line.strip() == next_location_start.strip():
                        next_block_start = i
                    elif next_block_start is not None and line.strip().startswith("if ($http_referer ~*"):
                        last_if_line = i
                    elif next_block_start is not None and line.strip() == "}" and i > next_block_start:
                        break
                if last_if_line != -1:
                    # Insert after the last if
                    insert_pos = last_if_line + 1
                    indent = "        "
                    referer_stanza = f'{indent}if ($http_referer ~* "/{name}/") {{\n{indent}    root /var/www/html/{name};\n{indent}}}\n'
                    lines.insert(insert_pos, referer_stanza.rstrip())
                    content = '\n'.join(lines)
                else:
                    print(f"Warning: Could not find position to add referer rule for {name}")
            else:
                print("Warning: /_next/ location not found in nginx config")

        with open(nginx_config_path, "w", encoding="utf-8") as f:
            f.write(content)

        print(f"Added nginx location for '/{name}'")

    def _remove_nginx_location(self, name: str) -> None:
        """Remove location block from nginx config for the app."""
        nginx_config_path = self.repo_root / "nginx" / "conf.d" / "default.conf"
        
        if not nginx_config_path.exists():
            return
        
        with open(nginx_config_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        
        new_lines = []
        skip_block = False
        brace_count = 0
        
        for line in lines:
            if f"location /{name}/" in line:
                skip_block = True
                brace_count = 0
            
            if skip_block:
                brace_count += line.count("{")
                brace_count -= line.count("}")
                if brace_count <= 0 and "}" in line:
                    skip_block = False
                continue
            
            new_lines.append(line)
        
        with open(nginx_config_path, "w", encoding="utf-8") as f:
            f.writelines(new_lines)
        
        print(f"Removed nginx location for '/{name}/'")

    def _generate_service_config(self, name: str, app_type: str = "static", language: str = "unknown") -> str:
        """Generate Docker Compose service configuration for an app."""
        # HTML apps are always static
        if language == "html":
            app_type = "static"
        
        if app_type == "static":
            # Static apps use builder pattern with volume output
            return f"""  {name}-builder:
    profiles: ["build"]
    build:
      context: ./apps/{name}
      dockerfile: Dockerfile
    volumes:
      - "{name}:/output"
    restart: "no"
"""
        else:  # server
            # Server apps run as containers proxied by nginx
            return f"""  {name}:
    container_name: tools_{name}
    build:
      context: ./apps/{name}
      dockerfile: Dockerfile
    restart: always
    env_file: ./apps/{name}/app.env
    networks:
      - backend
"""


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
    new_parser.add_argument("--server", action="store_true", help="Force server template for JS apps")

    # Copy command
    copy_parser = subparsers.add_parser(
        "copy", help="Copy an app from a git repository"
    )
    copy_parser.add_argument("name", help="Name of the app to create")
    copy_parser.add_argument("git_url", help="Git repository URL")
    copy_parser.add_argument(
        "--path", default="", help="Path within the repository (optional)"
    )

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
