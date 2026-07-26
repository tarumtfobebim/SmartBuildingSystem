# SmartBuildingSystem

SmartBuildingSystem is a small GitHub Pages frontend that signs users in and then redirects them to a live Node-RED dashboard behind a Cloudflare Tunnel. The repository also includes a lightweight proxy and a watcher script that keeps `config/backend.json` updated with the latest tunnel URL.

This README is written for the person setting up the repository after a fresh `git clone`.

After the first clone and initial GitHub setup, users do not need to open the GitHub repository every time they start the system. The updater script uses the GitHub token to publish the latest backend URL automatically.

The `.env` file is only for the local machine that runs the updater. It should not be committed to GitHub, and it does not affect whether your GitHub Pages site can be accessed.

## What This Project Does

- `index.html` serves the login page on GitHub Pages.
- `proxy-server.js` protects Node-RED admin routes and forwards dashboard traffic.
- `update-url.js` reads the latest Cloudflare Tunnel URL from `tunnel.log` and writes it to `config/backend.json`.
- `config/backend.json` stores the current backend URL used by the login page.
- `start-tunnel.bat` is a helper for starting Cloudflare Tunnel from Windows.

## Project Flow

1. A user opens the GitHub Pages site.
2. The login page checks the username and password.
3. The page loads `config/backend.json`.
4. The browser redirects to the latest `backend_url` value.
5. Cloudflare Tunnel exposes the local proxy.
6. The proxy forwards dashboard traffic to Node-RED and blocks direct flow-editor access unless the admin secret is present.

## Prerequisites

- Windows 11
- Node.js LTS
- Git for Windows
- A GitHub repository for this project
- A GitHub Personal Access Token with permission to update repository contents
- Cloudflare Tunnel binary (`cloudflared.exe`)
- Node-RED already running locally on `http://localhost:1880`

## Setup After Clone

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/SmartBuildingSystem.git
cd SmartBuildingSystem
```

### 2. Install dependencies

```bash
npm install
```

The repository already contains a `package.json`, so you only need to install the listed dependencies.

### 3. Create the GitHub token file

Create a file named `.env` in the project root and add your token:

```env
GITHUB_TOKEN=your_personal_access_token_here
```

Your token needs write access to the repository contents because `update-url.js` pushes updates to `config/backend.json`.

Add `.env` to `.gitignore` so the token stays local.

### 4. Update the repository settings in `update-url.js`

Open `update-url.js` and change these values to match your GitHub repository:

- `REPO_OWNER`
- `REPO_NAME`

If you forked or renamed the repository, these values must match your GitHub account and repo name.

### 5. Set your admin secret in `proxy-server.js`

Open `proxy-server.js` and change the secret value:

```js
const SECRET = 'YOUR_ADMIN_SECRET';
```

Use a long, random secret. Anyone with this value can open the Node-RED editor through the proxy.

Keep this value out of the README and out of public commits.

### 6. Confirm the backend config file exists

The repository already includes `config/backend.json`. Make sure it stays in the repository because the login page reads it directly from GitHub Pages.

Initial values can look like this:

```json
{
	"backend_url": "http://localhost:1880",
	"last_updated": "2026-01-01T00:00:00Z",
	"version": "1.0.0"
}
```

### 7. Place `cloudflared.exe` in the project root

Download Cloudflare Tunnel for Windows, rename the executable to `cloudflared.exe`, and place it in the root of this repository.

## GitHub Pages Setup

This project expects the frontend to be hosted on GitHub Pages.

1. Push the repository to GitHub.
2. Open the repository settings.
3. Go to Pages.
4. Choose the `main` branch and the root folder.
5. Wait for Pages to publish the site.

Your public site will look similar to:

```text
https://YOUR_USERNAME.github.io/SmartBuildingSystem/
```

## Running the Stack

There are two ways to run the system after setup:

1. Manual mode, where you open each process yourself.
2. Automated mode, where PM2 keeps the services running and Windows Scheduler starts PM2 on login.

## Method 1: Manual

Use this mode if you want the simplest setup or only need to test the system.

Run these components on the Windows machine that hosts Node-RED:

1. Node-RED on `http://localhost:1880`
2. The proxy on port `1881`
3. The URL watcher script
4. Cloudflare Tunnel pointing to the proxy

### Start the proxy

```bash
node proxy-server.js
```

The proxy listens on `http://localhost:1881` and forwards to Node-RED at `http://localhost:1880`.

### Start the URL watcher

```bash
node update-url.js
```

This script watches `tunnel.log`, finds the latest `trycloudflare.com` URL, writes it to `config/backend.json`, and pushes the updated file to GitHub if `GITHUB_TOKEN` is set.

### Start Cloudflare Tunnel

Use the proxy port, not Node-RED directly:

```bash
.\cloudflared.exe tunnel --url http://localhost:1881 --logfile tunnel.log
```

Note: the provided `start-tunnel.bat` file may need to be updated if you want it to use the proxy port instead of `1880`.

## Method 2: PM2 + Scheduler

Use this mode if you want the services to start automatically after login and stay online.

### Install PM2

```bash
npm install -g pm2
```

### Start the services with PM2

```bash
pm2 start update-url.js --name url-watcher
pm2 start proxy-server.js --name proxy-server
pm2 start .\cloudflared.exe --name cloudflared-tunnel -- tunnel --url http://localhost:1881 --logfile tunnel.log
pm2 save
```

### Create a Windows Scheduler task

Create a task that runs PM2 when the user signs in. One example is:

```bash
schtasks /create /tn "PM2 Startup" /tr "C:\Users\YOUR_USERNAME\AppData\Roaming\npm\pm2.cmd resurrect" /sc onlogon /ru YOUR_USERNAME /rl HIGHEST /f
```

If you prefer, you can change the command to `pm2 start` or another startup command that matches your workflow.

### Verify the services

```bash
pm2 list
```

All services should show as `online`.

## Login Page Behavior

The login page in `index.html` currently uses these credentials:

- Username: `YOUR_USERNAME`
- Password: `YOUR_PASSWORD`

After a successful login, the page fetches `config/backend.json` with cache busting and redirects to:

```text
backend_url + /ui/
```

If `backend_url` still points to `http://localhost:1880`, the page shows an unavailable message.

## Recommended Startup Order

For manual mode, start the services in this order:

1. Start Node-RED.
2. Start `proxy-server.js`.
3. Start `update-url.js`.
4. Start Cloudflare Tunnel.
5. Wait for `update-url.js` to push the latest URL to GitHub.
6. Open the GitHub Pages login page and sign in.

For PM2 mode, start PM2 first, then use `pm2 list` to confirm the services are online before opening the GitHub Pages login page.

## Example Manual Test

After everything is running, verify these URLs locally:

- `http://localhost:1881/` should redirect to `/ui/`
- `http://localhost:1881/ui/` should show the dashboard
- `http://localhost:1881/flows` should return `403 Access Denied`
- `http://localhost:1881/?admin=YOUR_SECRET` should allow editor access

## Common Tasks

### Update the backend URL manually

If needed, edit `config/backend.json` directly and change `backend_url` to the latest tunnel URL.

### Change the login credentials

Edit `index.html` and update the `VALID_USER` and `VALID_PASS` values in the script section with your own values.

### Change the proxy port

If port `1881` is already in use, update `PROXY_PORT` in `proxy-server.js` and also change the Cloudflare Tunnel command to match.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Login page redirects to localhost | `config/backend.json` has not been updated yet or GitHub Pages has not redeployed |
| GitHub push fails | Check `.env`, token permissions, `REPO_OWNER`, and `REPO_NAME` in `update-url.js` |
| Tunnel URL does not change | Make sure `tunnel.log` is being written and `update-url.js` is running |
| `/flows` is still accessible | Confirm the proxy is running and the tunnel points to port `1881` |
| Port already in use | Change the proxy port or stop the conflicting service |

## File Layout

```text
SmartBuildingSystem/
├── config/
│   └── backend.json
├── index.html
├── package.json
├── proxy-server.js
├── start-tunnel.bat
├── update-url.js
└── README.md
```

## Notes

- Keep `config/backend.json` committed so GitHub Pages can serve it.
- Use one primary Windows PC to run the tunnel and updater.
- Do not share the admin secret with regular users.
- Cloudflare Tunnel provides HTTPS for the public URL.

## License

This project is provided as-is. Adapt it to your own setup as needed.