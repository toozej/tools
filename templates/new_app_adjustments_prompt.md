# Tools Repo App Integration Agent

You are an agent tasked with integrating a new or copied app into the `tools` repository structure. Follow these steps sequentially:

## App Identification
First, determine:
- **App Name**: The directory name under `./apps/`
- **App Type**: 
  - **static/builder**: Static export NodeJS / NextJS apps (no server-side API routes) or pure HTML/CSS/JS apps - deployed via nginx from static files
  - **runtime**: Server apps with API routes - proxied via nginx to containers

## Step 1: Set Styling for NodeJS / NextJS apps
Copy the styling configuration from `./apps/homepage/`:
- Review `./apps/homepage/src/app/globals.css` and implement styling to the app's equivalent path
- Review `./apps/homepage/postcss.config.mjs` and implement styling to the app's root
- Ensure Tailwind CSS v4 with `@tailwindcss/postcss` is used

## Step 2: Configure Nginx
Update `./nginx/conf.d/default.conf` based on app type:

### For Static/Builder Apps:
Add a location block similar to existing static apps:
```nginx
location ^~ /{appName}/ {
    alias /var/www/html/{appName}/;
    try_files $uri $uri/ /{appName}/index.html;
}
```
- Add `if ($http_referer ~* "/{appName}/")` block under `location ^~ /_next/` section if the app is a NodeJS / NextJS app
- Add volume mount: `"tools_{appName}:/var/www/html/{appName}:ro"`

### For Runtime Apps:
Add a location block similar to existing runtime apps:
```nginx
location ^~ /{appName} {
    proxy_pass http://{appName}:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

## Step 3: Update docker-compose-dev.yml
Add service entry to `./docker-compose-dev.yml`:

### For Static/Builder Apps:
Add a builder service:
```yaml
  {appName}-builder:
    container_name: tools_{appName}-builder
    profiles: ["build"]
    build:
      context: ./apps/{appName}
      dockerfile: Dockerfile
    image: tools_{appName}-builder:latest
    volumes:
      - tools_{appName}:/app/out
    command: ["sleep", "5"]
```
- Add `tools_{appName}:` to volumes section near bottom of file
- Add builder as nginx `depends_on` with `condition: service_started`
- Add `"tools_{appName}:/var/www/html/{appName}:ro"` to nginx volumes section

### For Runtime Apps:
Add a runtime service:
```yaml
  {appName}:
    container_name: tools_{appName}
    build:
      context: ./apps/{appName}
      dockerfile: Dockerfile
    image: tools_{appName}:latest
    restart: always
    profiles: ["runtime"]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/{appName}/api/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - backend
```
- Add `depends_on` condition for runtime service in nginx

## Step 4: Configure Next.js Output Mode for NextJS apps
Update `./apps/{appName}/next.config.ts` based on app type:

### For Runtime Apps (like `./apps/gh-dashboard/next.config.ts`):
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/{appName}',
  output: "standalone",
};

export default nextConfig;
```

### For Static/Builder Apps (like `./apps/yaml-formatter/next.config.ts`):
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/{appName}',
  assetPrefix: '/{appName}',
  output: 'export',
  trailingSlash: true,
};

export default nextConfig;
```

## Step 5: Set basePath in tsconfig.json for NodeJS / NextJS apps
Ensure `./apps/{appName}/tsconfig.json` has baseUrl and paths configured:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## Step 6: Update package.json for NodeJS / NextJS apps
Make these changes in `./apps/{appName}/package.json`:
1. Set `"name": "{appName}"`
2. Update `"dependencies"` using `bun` or `npm`
3. Update `"devDependencies"` using `bun` or `npm`
4. Ensure there's a "next" script in `./apps/{appName}/package.json`, then disable telemetry by running `bun next telemetry disable`


## Step 7: Create README.md if one doesn't already exist
- If a README.md already exists, don't adjust it.
- If `./apps/{appName}/CONTEXT.md` exists, rename it to `README.md`
- Otherwise, generate a `README.md` with:
  - App description and purpose
  - Usage instructions
  - Any environment variables required
  - API endpoints (if runtime app)

## Step 8: Run Colophon Generation
Execute the colophon generation script:
```bash
uv run generate-colophon --output ./apps/homepage/src/data/colophon.json
```

## Step 9: Final Verification
- Ensure all file paths are correct
- Verify Dockerfiles are properly configured (multi-stage for runtime, single-stage for static)
- Confirm nginx configuration follows existing patterns
- Validate docker-compose entries match app type

## Reference Files
- Styling: `./apps/homepage/src/app/globals.css`
- Runtime Next.js Config: `./apps/gh-dashboard/next.config.ts`
- Static Next.js Config: `./apps/yaml-formatter/next.config.ts`
- Nginx Config: `./nginx/conf.d/default.conf`
- Docker Compose: `./docker-compose-dev.yml`
