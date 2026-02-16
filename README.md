# tools

![GitHub Actions CI Workflow Status](https://img.shields.io/github/actions/workflow/status/toozej/tools/ci.yaml)
![GitHub Actions Release Workflow Status](https://img.shields.io/github/actions/workflow/status/toozej/tools/release.yaml)
![Docker Pulls](https://ghcr-badge.elias.eu.org/shield/toozej/tools/tools)
![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/toozej/tools/total)

Tools and web-apps

## Usage

This repository leverages `Make` targets to simplify common operations. For those who prefer direct Docker Compose commands, alternatives are provided.

- Ensure you have Docker Compose installed.

### Production Mode

Runs the full tools stack using pre-built images from GitHub Container Registry (`ghcr.io/toozej/tools`).

- **Copy and adjust the production compose file:**
    ```bash
    cp docker-compose-prod.yml docker-compose.yml
    ```
    *   Adjust as needed (ports, reverse proxy, env files, etc.)
- **Start the full tools stack:**
    *   Using `make`:
    ```bash
    make up
    ```
    *   Alternatively, using Docker Compose directly:
    ```bash
    docker compose -f docker-compose.yml --profile build --profile runtime up -d
    ```
- Browse the apps at http://localhost:8080/
- **Stop the full tools stack:**
    *   Using `make`:
    ```bash
    make down
    ```
    *   Alternatively, using Docker Compose directly:
    ```bash
    docker compose -f docker-compose.yml --profile build --profile runtime down --remove-orphans
    ```

## Development Usage

For development, `docker-compose-dev.yml` is used. This allows you to develop without affecting your production `docker-compose.yml`.

### Start Development Services

- **To start the development environment (builds images if needed):**
    *   Using `make`:
    ```bash
    make dev
    ```
    *   Alternatively, using Docker Compose directly:
    ```bash
    docker compose -f docker-compose-dev.yml --profile build --profile runtime up --build -d
    ```
    *   Browse the apps at http://localhost:8080/

### Stop Development Services

- **To stop the development environment:**
    *   Using `make`:
    ```bash
    make dev-down
    ```
    *   Alternatively, using Docker Compose directly:
    ```bash
    docker compose -f docker-compose-dev.yml --profile build --profile runtime down --remove-orphans
    ```

### Clean Rebuild in Development

To perform a clean rebuild (without cache) in development:

-   Using `make`:
    ```bash
    make dev-nc
    ```
-   Alternatively, using Docker Compose directly:
    ```bash
    docker compose -f docker-compose-dev.yml --profile build --profile runtime down --remove-orphans
    docker compose -f docker-compose-dev.yml --profile build --profile runtime build --no-cache --pull
    docker compose -f docker-compose-dev.yml --profile build --profile runtime up -d
    ```
### manage
- install uv
- install pre-requisite packages
```bash
uv sync
```

#### "new" mode
- Create new Go app
```bash
uv run manage new my-service go
```
- Create new JavaScript/NextJS app (static by default)
```bash
uv run manage new my-dashboard js
```
- Create new JavaScript/NextJS app with server support (API routes, OAuth)
```bash
uv run manage new my-api js --server
```
- Create new HTML/static site
```bash
uv run manage new my-site html
```

#### "copy" mode

- Standard git URL
```bash
uv run manage copy my-app https://github.com/user/repo.git
```
- Kilocode app builder (paste the entire clone command)
```bash
uv run manage copy my-app "git clone https://x-access-token:eyJhbGc...@builder.kiloapps.io/apps/31df803a-a14a-4c33-82e9-d4b93a146db7.git"

```
- With path in repo
```bash
uv run manage copy my-app https://github.com/user/repo.git --path src/frontend
```

#### "remove" mode
- Remove app
```bash
uv run manage remove old-app

# or skip confirmation with
uv run manage remove old-app --force
```


### Supported Languages

| Language | Command | Description |
|----------|---------|-------------|
| `go` | `uv run manage new my-app go` | Go applications |
| `js` | `uv run manage new my-app js` | NextJS/Bun apps (static export) |
| `js --server` | `uv run manage new my-app js --server` | NextJS/Bun apps with API routes |
| `html` | `uv run manage new my-app html` | Pure HTML/CSS/vanilla JS sites |


### Building and Deployment

The tools repository supports two deployment patterns:

#### Static Apps (HTML, JS static)
Static apps are built once and served by nginx. Build output is stored in Docker volumes.

#### Server Apps (JS server, Go)
Server apps run as long-running containers proxied by nginx via the backend network.

### Template Files

Templates are located in the `templates/` directory:

| File | Purpose |
|------|---------|
| `Dockerfile.go` | Go application Dockerfile |
| `Dockerfile.js.static` | NextJS static export Dockerfile |
| `Dockerfile.js.server` | NextJS server Dockerfile |
| `Dockerfile.html` | Pure HTML/CSS/JS Dockerfile |
| `.dockerignore.go` | Go .dockerignore template |
| `.dockerignore.js` | JavaScript .dockerignore template |
| `.dockerignore.html` | HTML .dockerignore template |

See [`templates/README.md`](templates/README.md) for detailed template documentation.


### generate-colophon
- Generate colophon.json in repo root
```bash
uv run generate-colophon
```
- Specify output location (e.g., for use by the homepage app)
```bash
uv run generate-colophon --output ./apps/homepage/src/data/colophon.json
```
- Specify different repo location
```bash
uv run generate-colophon --repo /path/to/tools
```
- Verbose mode for debugging
```bash
uv run generate-colophon -v
```
