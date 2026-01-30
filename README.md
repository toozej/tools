# tools

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/toozej/tools/cicd.yaml)
![Docker Pulls](https://img.shields.io/docker/pulls/toozej/tools)
![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/toozej/tools/total)

Tools and web-apps

## Usage
- Ensure you have Docker Compose installed
- Move the example Docker Compose file into place
```bash
cp docker-compose-example.yml docker-compose.yml
```
- build and run the full tools stack of apps
```bash
docker compose --profile build build --pull
docker compose up -d
```
- stop full tools stack
```bash
docker compose down --remove-orphans
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

```bash
# Build all static apps (run once, or when rebuilding after changes)
docker compose --profile build up

# Start nginx to serve static apps
docker compose up -d www
```

#### Server Apps (JS server, Go)
Server apps run as long-running containers proxied by nginx via the backend network.

```bash
# Start all services (nginx + all server apps)
docker compose up -d

# Or start specific server apps individually
docker compose up -d gh-dashboard www2s www2epub
```

#### Full Deployment
To deploy everything:

```bash
# 1. Build static apps first
docker compose --profile build up

# 2. Start all services
docker compose up -d
```


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
- Specify output location (e.g., for NextJS public folder)
```bash
uv run generate-colophon --output ./homepage/public/colophon.json
```
- Specify different repo location
```bash
uv run generate-colophon --repo /path/to/tools
```
- Verbose mode for debugging
```bash
uv run generate-colophon -v
```
