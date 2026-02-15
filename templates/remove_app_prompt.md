# Tools Repo App Removal Agent

You are an agent tasked with removing a Next.js app from the `tools` repository structure. Follow these steps sequentially:

## App Identification
First, determine:
- **App Name**: The directory name under `./apps/` that needs to be removed

## Step 1: Remove docker-compose-dev.yml Service Block
In `./docker-compose-dev.yml`, remove the entire service block for the removed app:

### For Static/Builder Apps:
Remove the builder service block:
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

### For Runtime Apps:
Remove the runtime service block:
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

## Step 2: Remove nginx depends_on and Volumes
In `./docker-compose-dev.yml`, under the `www` (nginx) service:

### Remove depends_on condition:
Remove the builder condition from nginx's `depends_on` section:
```yaml
      {appName}-builder:
        condition: service_started
```

### Remove volumes mount:
Remove the volume mount for the removed app:
```yaml
      - "tools_{appName}:/var/www/html/{appName}:ro"
```

## Step 3: Remove docker-compose-dev.yml Volumes Block
In `./docker-compose-dev.yml`, remove the volume entry for the removed app from the volumes section:
```yaml
volumes:
  tools_{appName}:
```

## Step 4: Remove Nginx Config Blocks
In `./nginx/conf.d/default.conf`, remove all configuration blocks for the removed app:

### Remove _next if block:
Remove the `if` condition for the app in the `location ^~ /_next/` block:
```nginx
        if ($http_referer ~* "/{appName}/") {
            root /var/www/html/{appName};
        }
```

### Remove location block:
Remove the entire location block for the app:
```nginx
    location ^~ /{appName}/ {
        alias /var/www/html/{appName}/;
        try_files $uri $uri/ /{appName}/index.html;
    }
```
Or for runtime apps:
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

## Step 5: Remove Mentions from README.md
In `./README.md`, remove all mentions of the removed app:
- Remove from the apps list/table
- Remove any links to the app
- Remove any documentation about the app

## Step 6: Re-run Colophon Generation
Execute the colophon generation script to update the homepage colophon:
```bash
uv run colophon --output ./apps/homepage/src/data/colophon.json
```

## Step 7: Final Verification
- Verify all docker-compose entries are removed
- Confirm nginx configuration has no references to the removed app
- Ensure README.md no longer mentions the app
- Confirm colophon.json is regenerated without the removed app

## Reference Files
- Docker Compose: `./docker-compose-dev.yml`
- Nginx Config: `./nginx/conf.d/default.conf`
- Main README: `./README.md`
