# JS/Bun Template Overview

This repository provides two Dockerfile templates for JS/Bun applications built with Next.js:

- `templates/Dockerfile.js.static` - For static export apps served by nginx
- `templates/Dockerfile.js.server` - For apps requiring Node.js runtime (API routes, server-side features)

## Static Template (`Dockerfile.js.static`)

Use this template for pure client-side apps that can be statically exported.

- **Examples**: taboo, unit-converter, yaml-formatter
- **Requirements**: Set `output: 'export'` in `next.config.ts`
- **Output**: Builds to a Docker volume for nginx serving
- **Build Command**: `docker-compose --profile build up`

## Server Template (`Dockerfile.js.server`)

Use this template for applications that require server-side functionality.

- **Examples**: gh-dashboard, clip2gist, www2s
- **Features**: API routes, OAuth, server-side rendering
- **Runtime**: Runs as a long-running Node.js service
- **Output**: Uses standalone Next.js output

## App Classification Table

| App | Template Type | Reason |
|-----|---------------|--------|
| taboo | Static | Pure client-side game |
| unit-converter | Static | Pure client-side |
| yaml-formatter | Static | Pure client-side |
| gh-dashboard | Server | Has /api/repos route |
| clip2gist | Server | OAuth + API routes |
| www2s | Server | TTS API routes |

## Usage Instructions

### Building Static Apps

To build a static app, use the build profile:

```bash
docker-compose --profile build up
```

### Adding New Static Apps to docker-compose.yml

1. Add a new service in `docker-compose.yml` using the static template
2. Configure the build context and volumes appropriately
3. Ensure nginx configuration includes the new app's location

### Configuring nginx for New Apps

Update the nginx configuration in `nginx/conf.d/default.conf` to serve the new static app from its designated path.