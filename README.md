## Docker usage

Build the image:

```bash
docker build -t chatgpt-apps-hello-world .
```

Run the container (listens on port 3000):

```bash
docker run --rm -p 3000:3000 --env-file .env chatgpt-apps-hello-world
```

Or use Docker Compose:

```bash
docker compose up --build
```

Ensure the `.env` file contains any required configuration such as `OPENWEATHER_API_KEY`.

### Caddy reverse proxy

The provided `docker-compose.yml` also includes a Caddy service for HTTPS termination.

1. Set these values in `.env`:
   ```
   DOMAIN=your.domain.com
   CADDY_ADMIN_EMAIL=admin@your.domain.com   # optional, used for ACME notices
   ```
2. Point the domain’s DNS A/AAAA record at your server.
3. Start the stack and let Caddy obtain certificates automatically:
   ```bash
   docker compose up --build
   ```

Caddy will listen on ports 80/443 and forward requests to the app container on port 3000. For local testing without a public domain you can set `DOMAIN=localhost`, which lets Caddy serve plain HTTP.
