# Recombine

Monorepo containing the Recombine game server and client.

## Structure

- **RecombineServer** — Node.js multiplayer Ogar-style game server
- **RecombineClient** — Web client (HTML/JS/PHP)

## Getting Started

### Server

```bash
cd RecombineServer
yarn install
yarn start
```

### Client

Serve the `RecombineClient` directory with a web server that supports PHP (e.g. Apache, nginx, or PHP's built-in server).

## License

See `RecombineServer/LICENSE.txt` (Apache-2.0).

## Auto-push to GitHub

This repo includes a Cursor hook (`.cursor/hooks.json`) that commits and pushes changes when an agent session ends, then **restarts both servers** automatically.

To start both servers manually:

```powershell
.\scripts\start-servers.ps1
```

To restart both servers:

```powershell
.\scripts\restart-servers.ps1
```

To push and restart:

```powershell
.\scripts\auto-push.ps1
```

Open the game at **http://localhost:8080/#localhost**
