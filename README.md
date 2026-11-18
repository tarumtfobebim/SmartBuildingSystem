# SmartBuildingSystem

SmartBuildingSystem provides a GitHub Pages login page for accessing a local Node-RED dashboard through a Cloudflare Tunnel.

The repository includes:

- A frontend login page.
- A proxy server for forwarding dashboard traffic to Node-RED.
- A URL watcher that updates GitHub Pages with the latest Cloudflare Tunnel URL.
- A Delta OHM Cloud reader that retrieves weather station readings and stores the latest data in Firebase Cloud Firestore.

This README explains how to set up the system after cloning the repository and configure automatic startup on Windows.

After the initial setup, users do not need to open the GitHub repository whenever the system starts. The URL watcher uses a GitHub token to update the backend URL automatically.

## What This Project Does

| Component | Purpose |
| --- | --- |
| `index.html` | Displays the login page and loads the Node-RED dashboard in a full-page iframe after successful authentication. |
| `scripts/proxy-server.js` | Handles login requests, supports dashboard embedding, forwards traffic to Node-RED, and restricts selected editor routes using an admin secret. |
| `scripts/update-url.js` | Reads the latest Cloudflare Tunnel URL from `tunnel.log`, updates `config/backend.json`, and publishes the change to GitHub. |
| `config/backend.json` | Stores the backend URL used by the frontend. |
| `scripts/deltaohm.js` | Reads weather station values from Delta OHM Cloud and writes changed readings to Firestore. |

If your local setup includes `start-tunnel.bat`, it can also be used as a helper for starting Cloudflare Tunnel. Ensure its command points to the proxy port, `1881`.

## Project Flow

### Dashboard access

1. A user opens the GitHub Pages site.
2. The frontend reads `config/backend.json` to obtain the latest backend URL.
3. The frontend submits the username and password to the proxy's `/auth` endpoint.
4. The proxy checks the credentials configured in the local `.env` file.
5. After successful authentication, the frontend loads the Node-RED dashboard inside an iframe.
6. Cloudflare Tunnel forwards public requests to the local proxy.
7. The proxy forwards dashboard traffic to Node-RED.

The frontend stores an authentication token locally and checks it through `/auth/verify` when restoring a session.

### Delta OHM weather data

1. `scripts/deltaohm.js` opens Delta OHM Cloud in a visible Chromium browser.
2. The operator signs in if required and opens the TAR-UMT visualization.
3. The reader checks the displayed sensor values every 60 seconds.
4. When at least one sensor value changes, the reader writes the latest reading to Firestore.
5. The existing Node-RED weather flow reads the `deltaohm/latest` document for dashboard display.

The reader uses a persistent browser profile so the login session can be reused between runs.

## Prerequisites

- A Windows PC with a desktop session.
- A Node.js LTS version compatible with the repository dependencies.
- npm.
- Git for Windows.
- Access to this GitHub repository.
- A GitHub Personal Access Token with permission to update repository contents.
- Cloudflare Tunnel executable: `cloudflared.exe`.
- Node-RED installed and configured locally at `http://localhost:1880`.
- The required Node-RED dashboard flows and nodes.
- A Firebase project with Cloud Firestore enabled.
- A Firebase service-account key with permission to write the weather data.
- A Delta OHM Cloud account with access to the TAR-UMT visualization.
- PM2 if automatic process management is required.

The Node-RED installation, flows, credentials, and local static files must be configured separately on the host PC.

## Setup After Clone

### 1. Clone the repository

```bash
git clone https://github.com/tarumtfobebim/SmartBuildingSystem.git
cd SmartBuildingSystem
```

Run subsequent project commands from this repository's root directory unless stated otherwise.

### 2. Install dependencies

```bash
npm install
```

The repository already includes the required dependencies, including:

- `axios`
- `chokidar`
- `dotenv`
- `fs-extra`
- `http-proxy`
- `puppeteer`
- `firebase-admin`

Puppeteer normally downloads its browser during installation. Allow the installation to finish before starting the Delta OHM reader.

### 3. Create the local configuration file

Create a file named `.env` in the repository root:

```env
GITHUB_TOKEN=your_github_personal_access_token
REPO_OWNER=tarumtfobebim
REPO_NAME=SmartBuildingSystem

TARGET=http://localhost:1880
PROXY_PORT=1881

SECRET=replace_with_a_long_random_admin_secret
AUTH_USER=replace_with_dashboard_username
AUTH_PASS=replace_with_dashboard_password
AUTH_TOKEN_SECRET=replace_with_a_separate_long_random_token_secret
```

| Variable | Purpose |
| --- | --- |
| `GITHUB_TOKEN` | Allows the URL watcher to update `config/backend.json` on GitHub. |
| `REPO_OWNER` | GitHub account or organization that owns the repository. |
| `REPO_NAME` | GitHub repository name. |
| `TARGET` | Local Node-RED address. |
| `PROXY_PORT` | Port used by the local proxy. |
| `SECRET` | Admin secret used for selected Node-RED editor routes through the proxy. |
| `AUTH_USER` | Username accepted by the login endpoint. |
| `AUTH_PASS` | Password accepted by the login endpoint. |
| `AUTH_TOKEN_SECRET` | Secret used to sign authentication tokens. |

The current URL watcher publishes updates to the `main` branch.

Keep `.env` local. Do not commit it or place its contents in frontend files.

The `.env` file is used by the backend scripts on the host PC. GitHub Pages does not load it.

### 4. Confirm the repository settings

The current `scripts/update-url.js` reads `REPO_OWNER` and `REPO_NAME` from `.env`.

For this repository, use:

```env
REPO_OWNER=tarumtfobebim
REPO_NAME=SmartBuildingSystem
```

If you fork or rename the repository, update these values.

The GitHub token must have access to the selected repository and permission to update its contents.

### 5. Configure the admin secret

The current `scripts/proxy-server.js` reads the admin secret from `.env`:

```env
SECRET=replace_with_a_long_random_admin_secret
```

Use a long, random value and share it only with authorized administrators.

Direct proxy editor access uses this format:

```text
http://localhost:1881/?admin=YOUR_ADMIN_SECRET
```

The frontend also contains an admin-mode check in `index.html`. If you use admin access through the GitHub Pages frontend, review that check so it matches your intended configuration.

### 6. Confirm the backend configuration file exists

Keep `config/backend.json` in the repository because GitHub Pages serves it to the frontend.

An initial configuration can look like this:

```json
{
  "backend_url": "http://localhost:1880",
  "last_updated": "2026-01-01T00:00:00Z",
  "version": "1.0.0"
}
```

Once the tunnel and URL watcher are running, the watcher replaces `backend_url` with the latest public tunnel URL.

The frontend treats the initial `http://localhost:1880` value as unavailable.

### 7. Add Cloudflare Tunnel

Download the Windows Cloudflare Tunnel executable and place it in the repository root with this name:

```text
cloudflared.exe
```

The tunnel must point to the proxy:

```text
http://localhost:1881
```

### 8. Add the Firebase service-account key

Place the Firebase service-account JSON file in the repository root:

```text
SmartBuildingSystem/serviceAccountKey.json
```

The Delta OHM script loads it using:

```js
require("../serviceAccountKey.json")
```

The expected locations are:

```text
SmartBuildingSystem/
├── scripts/
│   └── deltaohm.js
└── serviceAccountKey.json
```

Use a service account for the Firebase project that should receive the weather readings.

Do not commit or share this credential file.

### 9. Confirm the ignored files

Keep these entries in `.gitignore`:

```gitignore
.env
node_modules/
tunnel.log
serviceAccountKey.json
deltaohm-browser-profile/
```

The browser profile is generated inside `scripts/`. The existing `deltaohm-browser-profile/` ignore pattern also matches that directory.

Ignoring a file does not remove it from Git history if it was previously committed.

## GitHub Pages Setup

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Select deployment from a branch.
4. Choose the `main` branch.
5. Choose the root folder.
6. Save and wait for deployment to finish.

The frontend address is:

```text
https://tarumtfobebim.github.io/SmartBuildingSystem/
```

GitHub Pages hosts the frontend and configuration file. The host PC runs Node-RED, the proxy, the tunnel, the URL watcher, and the Delta OHM reader.

## Running the Stack

There are two ways to run the system:

1. Manual mode: start each component yourself.
2. PM2 mode: manage the processes with PM2 and restore them automatically after Windows sign-in.

Use one method at a time to avoid starting duplicate processes.

## Method 1: Manual

Open separate terminals for the long-running components.

For the repository scripts, open each terminal in the repository root.

### 1. Start Node-RED

```bash
node-red
```

Confirm Node-RED is available at:

```text
http://localhost:1880
```

### 2. Start the proxy

```bash
node scripts/proxy-server.js
```

The default proxy address is:

```text
http://localhost:1881
```

It forwards traffic to Node-RED at:

```text
http://localhost:1880
```

### 3. Start the URL watcher

```bash
node scripts/update-url.js
```

The watcher:

- Monitors `tunnel.log`.
- Finds the latest `trycloudflare.com` URL.
- Updates the local `config/backend.json`.
- Publishes the updated file to GitHub using `GITHUB_TOKEN`.

### 4. Start Cloudflare Tunnel

```powershell
.\cloudflared.exe tunnel --url http://localhost:1881 --logfile tunnel.log
```

If you use a local `start-tunnel.bat` helper, ensure it points to port `1881`.

### 5. Start the Delta OHM reader

```bash
node scripts/deltaohm.js
```

A visible Chromium window opens.

1. Sign in to Delta OHM Cloud if required.
2. Open the TAR-UMT visualization.
3. Leave that visualization open.
4. Keep the browser running while weather data collection is required.

The reader checks sensor values every 60 seconds and writes changed readings to Firestore.

### 6. Open the frontend

Wait for the URL watcher to publish the latest backend URL and for GitHub Pages to finish deployment.

Open:

```text
https://tarumtfobebim.github.io/SmartBuildingSystem/
```

Sign in using `AUTH_USER` and `AUTH_PASS` from `.env`.

## Method 2: PM2 + Windows Task Scheduler

Use this method to manage the processes and restore them after Windows sign-in.

Because Delta OHM uses a visible browser, run the system under the Windows user account that will operate the dashboard.

### 1. Install PM2

```bash
npm install -g pm2
```

Confirm installation:

```bash
pm2 --version
```

### 2. Open the repository directory

For example, in Command Prompt:

```cmd
cd /d D:\SmartBuildingSystem
```

Replace the path with your actual repository location.

Start the processes from this directory so the proxy and URL watcher can load the root `.env` file.

### 3. Start the services

For Node-RED installed globally through npm on Windows, start its JavaScript entry point:

```cmd
pm2 start "%APPDATA%\npm\node_modules\node-red\red.js" --name node-red
```

If Node-RED is installed elsewhere, replace the path with its actual `red.js` location.

Start the repository scripts:

```cmd
pm2 start scripts/update-url.js --name url-watcher
pm2 start scripts/proxy-server.js --name proxy-server
pm2 start scripts/deltaohm.js --name deltaohm-reader
```

Start Cloudflare Tunnel:

```cmd
pm2 start .\cloudflared.exe --name cloudflared-tunnel --interpreter none -- tunnel --url http://localhost:1881 --logfile tunnel.log
```

Stop any manually started copies before starting these PM2 processes.

### 4. Complete the Delta OHM browser setup

When Chromium opens:

1. Sign in if required.
2. Open the TAR-UMT visualization.
3. Leave the visualization open.

PM2 starts the reader process, but login and visualization selection may still require manual interaction.

### 5. Verify and save the process list

```bash
pm2 list
```

The expected processes are:

- `node-red`
- `url-watcher`
- `proxy-server`
- `deltaohm-reader`
- `cloudflared-tunnel`

After confirming that the required processes are running:

```bash
pm2 save
```

This saves the process list that `pm2 resurrect` restores.

Run `pm2 save` again whenever you intentionally change the saved process list.

### 6. Create a Windows Task Scheduler Task

Configure Windows Task Scheduler to automatically restore the saved PM2 processes when the Windows user logs in.

This allows the PM2-managed applications to restart after a PC reboot without manually executing `pm2 resurrect`.

**Important notes:**
- Creating the scheduled task does not affect currently running PM2 processes.
- The task runs when the specified Windows user logs in or when manually triggered.
- Select **Run only when user is logged on**, because Delta OHM requires a visible browser.
- Ensure `pm2 save` has been executed before configuring the scheduled task.

#### Option A: Create the Task Using Task Scheduler (GUI)

For the `PC12` account:

1. Press `Win + R`, enter `taskschd.msc`, and press Enter.
2. Select **Create Task**.
3. Enter `PM2 Startup` as the task name.
4. Select the Windows account used to run PM2 (`PC12`).
5. Select **Run only when user is logged on**.
6. Under **Triggers**, create an **At log on** trigger for `PC12`.
7. Under **Actions**, create a **Start a program** action.

Use the following settings:

**Program/script:**
```text
C:\Windows\System32\cmd.exe
```

**Add arguments:**
```text
/c ""C:\Users\PC12\AppData\Roaming\npm\pm2.cmd" resurrect"
```

**Start in:**
```text
D:\SmartBuildingSystem
```

Replace the repository path if necessary.

Save the task.

#### Option B: Create the Task Using CMD (Recommended for Quick Setup)

Open **Command Prompt as Administrator**.

**Step 1: Save the current PM2 processes**

```cmd
pm2 save
```

This saves the current PM2 process list for restoration.

**Step 2: Create the scheduled task**

For PC12:

```cmd
schtasks /create /tn "PM2 Startup" /tr "cmd.exe /c C:\Users\PC12\AppData\Roaming\npm\pm2.cmd resurrect" /sc onlogon /ru PC12 /rl HIGHEST /f
```

For PC2, if the Windows username is `PC2` and PM2 is installed under its user profile:

```cmd
schtasks /create /tn "PM2 Startup" /tr "cmd.exe /c C:\Users\PC2\AppData\Roaming\npm\pm2.cmd resurrect" /sc onlogon /ru PC2 /rl HIGHEST /f
```

Replace the username and PM2 path according to the PC configuration. Use `where pm2` to confirm the installation path.

The command creates a task that:
- Runs when the specified Windows user logs in.
- Executes `pm2 resurrect` to restore saved PM2 processes.
- Requests the highest available privileges.
- Replaces an existing task with the same name if one exists.

**Note:** The CMD method does not automatically configure the repository's **Start in** directory. If a specific working directory is required, configure it through the Task Scheduler GUI or use a wrapper script.

#### Verify the Scheduled Task

Check whether the task was created successfully:

```cmd
schtasks /query /tn "PM2 Startup" /v /fo LIST
```

The task should appear with its status as `Ready` before its first execution.

#### Test the Scheduled Task

Manually trigger the task:

```cmd
schtasks /run /tn "PM2 Startup"
```

Then check the PM2 process list:

```cmd
pm2 list
```

Confirm that the saved applications are running. If they were already online, this check alone does not prove that they were restored successfully.

#### Delete the Scheduled Task

To remove the PM2 Startup task, open CMD as Administrator and run:

```cmd
schtasks /delete /tn "PM2 Startup" /f
```

Verify the deletion:

```cmd
schtasks /query /tn "PM2 Startup"
```

If the task was deleted successfully, Windows should report that the task cannot be found.

**Note:** Deleting the scheduled task does not stop currently running PM2 processes, uninstall PM2, or remove the saved PM2 configuration. It only disables automatic restoration through this scheduled task.

#### Important: Startup Behaviour

The task uses the `onlogon` trigger, meaning it executes when the configured Windows user signs in, not immediately when the computer powers on.

Since Delta OHM requires a visible browser, the task should remain configured to run in an interactive user session.

### 7. Fallback: use the Windows Startup folder

If the Task Scheduler setup cannot be completed or does not work, use the Windows Startup folder instead.

First, confirm that the PM2 process list has been saved:

```bash
pm2 save
```

Then:

1. Press **Win + R**.
2. Type:

   ```text
   shell:startup
   ```

3. Press **Enter**.
4. Inside the Startup folder, right-click an empty area.
5. Select **New → Shortcut**.
6. Enter this location:

   ```text
   C:\Users\PC12\AppData\Roaming\npm\pm2.cmd resurrect
   ```

7. Click **Next**.
8. Enter this name:

   ```text
   PM2 Startup
   ```

9. Click **Finish**.

For another Windows account, replace `PC12` with that account's folder name.

You can check the installed PM2 command location in Command Prompt with:

```cmd
where pm2
```

This shortcut runs `pm2 resurrect` after the user signs in to Windows.

Use the same Windows account that originally started and saved the PM2 processes.

If you use the Startup-folder shortcut, disable any equivalent Task Scheduler task so there is only one startup method.

### 8. Verify automatic startup

After signing out and signing back in, or restarting the PC and signing in:

```bash
pm2 list
```

Check that:

- The required processes show as `online`.
- The local Node-RED dashboard loads.
- The tunnel is connected.
- `config/backend.json` receives the current tunnel URL.
- The Delta OHM browser opens.
- The TAR-UMT visualization is selected.
- Firestore receives weather readings when values change.

Automatic process startup happens after Windows sign-in. It does not remove the need to sign in to Delta OHM Cloud again if its session expires.

## Delta OHM Cloud Integration

### Overview

The Delta OHM reader uses Puppeteer to read weather station values displayed on the Delta OHM Cloud dashboard.

It writes the latest changed reading to:

```text
Collection: deltaohm
Document: latest
```

The document path is:

```text
deltaohm/latest
```

### Features

- Opens `https://deltaohm.cloud/` in Chromium.
- Reuses a persistent browser profile.
- Supports manual login and TAR-UMT visualization selection.
- Reads the displayed weather station values every 60 seconds.
- Skips repeated writes when the parsed sensor values have not changed during the current process run.
- Stores an ISO 8601 `updatedAt` timestamp with each successful update.
- Skips a write when all parsed sensor values are `null`.
- Logs successful updates and errors.

### Current configuration

These settings are defined in `scripts/deltaohm.js`:

| Setting | Current value |
| --- | --- |
| Dashboard URL | `https://deltaohm.cloud/` |
| Read interval | `60000` milliseconds / 60 seconds |
| Browser profile | `scripts/deltaohm-browser-profile/` |
| Firestore collection | `deltaohm` |
| Firestore document | `latest` |
| Browser viewport | `1440 × 900` |
| Browser mode | Visible: `headless: false` |
| Firebase credential | Root-level `serviceAccountKey.json` |

The Delta OHM script currently uses constants and the service-account file for configuration. It does not read the proxy's `.env` settings.

### Weather data fields

| Field | Description | Unit |
| --- | --- | --- |
| `temperature` | Temperature PT100 reading | °C |
| `windSpeed` | Wind speed | m/s |
| `windDirection` | Wind direction | Degrees |
| `relativeHumidity` | Relative humidity | % |
| `dewPoint` | Dew point | °C |
| `solarRadiation` | Solar radiation | W/m² |
| `atmosphericPressure` | Atmospheric pressure | mbar |
| `maxRainRate` | Maximum rain rate | mm/h |
| `dailyRain` | Daily rainfall | mm |
| `totalRain` | Total rainfall | mm |
| `batteryVoltage` | Weather station battery voltage | V |
| `updatedAt` | Time the reader prepared the successful Firestore update | ISO 8601 UTC string |

### Example Firestore document

```json
{
  "updatedAt": "2026-11-05T12:03:34.110Z",
  "temperature": 31.3,
  "windSpeed": 1.4,
  "windDirection": 161.2,
  "relativeHumidity": 68,
  "dewPoint": 24.7,
  "solarRadiation": 525,
  "atmosphericPressure": 997.9,
  "maxRainRate": 0,
  "dailyRain": 0,
  "totalRain": 7226.2,
  "batteryVoltage": 10.98
}
```

These values are examples.

A value that cannot be found on the page is stored as `null`, provided at least one other sensor value was found.

### Firestore write behavior

The reader compares the parsed sensor values with the last successfully written values held in memory.

- The first valid reading after process startup is written.
- Later readings are written only when a parsed sensor value changes.
- If all values are unchanged, the write is skipped.
- If every parsed value is `null`, the write is skipped.
- If a write fails, the reader logs the error and can retry on a later polling cycle.

`updatedAt` changes when a reading is written. It is not a heartbeat updated every 60 seconds.

Only the latest reading is retained. The script does not create historical records.

### Node-RED integration

Configure the existing Node-RED weather flow to read:

```text
Collection: deltaohm
Document ID: latest
```

Use the returned fields to populate the weather dashboard.

The reader writes to Firestore independently. Node-RED must have its own working Firestore connection and dashboard flow to display the data.

### Changing the read interval

Open:

```text
scripts/deltaohm.js
```

Find:

```js
const READ_INTERVAL = 60000;
```

For example, to check every two minutes:

```js
const READ_INTERVAL = 120000;
```

Restart the reader after saving.

For PM2:

```bash
pm2 restart deltaohm-reader
```

### Limitations

- Login and visualization selection may require manual interaction.
- The browser must remain open on the required visualization.
- Dashboard layout or label changes may affect parsing.
- Only the latest reading is stored.
- PM2 showing `online` confirms that the process is running; it does not confirm that valid weather readings are being collected.
- The current browser configuration accepts insecure certificates.
- A polling cycle could overlap with the next cycle if processing takes longer than the configured interval.

## Login Page Behavior

The current frontend authenticates through the proxy.

The login credentials are configured in `.env`:

```env
AUTH_USER=your_username
AUTH_PASS=your_password
```

After successful login:

1. The frontend stores the returned authentication token in browser local storage.
2. The login form is hidden.
3. The dashboard opens inside a full-page iframe using:

   ```text
   backend_url + /ui/
   ```

4. A Logout button is displayed.

When the page is reopened, the frontend attempts to validate the saved token through `/auth/verify`.

The current proxy issues tokens with a seven-day expiry.

The frontend also includes dashboard reconnection behavior for network recovery and periodic iframe reloads.

The login flow controls frontend access. Configure Node-RED's own authentication and access controls if the underlying dashboard or editor must be protected against direct requests.

## Recommended Startup Order

### Manual mode

1. Start Node-RED.
2. Start the proxy.
3. Start the URL watcher.
4. Start Cloudflare Tunnel.
5. Start the Delta OHM reader.
6. Sign in to Delta OHM Cloud if required and open the TAR-UMT visualization.
7. Wait for the latest backend URL to be published.
8. Open the GitHub Pages site and sign in.

### PM2 mode

1. Sign in to the configured Windows account.
2. Allow Task Scheduler or the Startup-folder shortcut to restore PM2.
3. Run `pm2 list`.
4. Confirm the required processes are online.
5. Check the Delta OHM browser and visualization.
6. Confirm dashboard access and Firestore updates.

## Example Manual Test

### Proxy and dashboard

Check these local URLs:

| URL | Expected result |
| --- | --- |
| `http://localhost:1881/` | Redirects to `/ui/` when no valid admin query is supplied. |
| `http://localhost:1881/ui/` | Loads the Node-RED dashboard. |
| `http://localhost:1881/flows` | Returns `403 Access Denied` without the admin secret. |
| `http://localhost:1881/?admin=YOUR_ADMIN_SECRET` | Allows the proxied root editor route, subject to Node-RED's own configuration. |

### Delta OHM reader

1. Start the reader.
2. Sign in and open the TAR-UMT visualization.
3. Allow approximately one polling interval for the first valid reading.
4. Look for a successful Firestore update in the terminal or PM2 logs.
5. Check the `deltaohm/latest` document in Firestore.
6. Confirm the Node-RED weather dashboard reads the same document.

If readings remain unchanged, repeated Firestore writes are intentionally skipped.

## Common Tasks

### Update the backend URL manually

Edit:

```text
config/backend.json
```

Set `backend_url` to the current Cloudflare Tunnel URL.

Publish the file to GitHub so GitHub Pages serves the updated configuration.

The URL watcher may replace this value when it detects another tunnel URL.

### Change login credentials

Update these values in `.env`:

```env
AUTH_USER=new_username
AUTH_PASS=new_password
```

Restart the proxy.

For PM2:

```bash
pm2 restart proxy-server
```

### Change the proxy port

Update `.env`:

```env
PROXY_PORT=1881
```

Change the Cloudflare Tunnel command to use the same port and restart both components.

### View PM2 processes

```bash
pm2 list
```

### View logs

```bash
pm2 logs
```

For a specific component:

```bash
pm2 logs deltaohm-reader
pm2 logs url-watcher
pm2 logs proxy-server
pm2 logs cloudflared-tunnel
```

### Restart a process

```bash
pm2 restart deltaohm-reader
```

Replace the name with the required process.

### Save the current process list

```bash
pm2 save
```

### Restore the saved process list manually

```bash
pm2 resurrect
```

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Frontend reports that the dashboard is unavailable | Confirm `config/backend.json` contains a public tunnel URL and GitHub Pages has deployed the change. |
| Login fails | Check `AUTH_USER` and `AUTH_PASS` in `.env`, then restart the proxy. |
| Proxy fails during startup | Confirm the `.env` file exists in the working directory and required values, including `AUTH_PASS`, are present. |
| GitHub update fails | Check token permissions, repository access, `REPO_OWNER`, and `REPO_NAME`. |
| Tunnel URL does not update | Confirm the tunnel writes to the root `tunnel.log` and the URL watcher is running. |
| `/flows` is accessible without the expected restriction | Confirm traffic passes through the proxy and the tunnel points to port `1881`. |
| Dashboard does not load inside the iframe | Check proxy response headers, the allowed frame origins, and the browser console. |
| Port already in use | Stop the conflicting process or update the relevant port configuration. |
| Task Scheduler setup cannot be completed | Use the Startup-folder shortcut described above. |
| PM2 restores no processes | Run `pm2 save` after starting the required processes and use the same Windows account for startup. |
| Delta OHM reports that the credential file is missing | Place `serviceAccountKey.json` in the repository root. |
| Delta OHM browser opens but no readings appear | Sign in, open the TAR-UMT visualization, and keep it open. |
| Reader reports `Sensor values not found` | Check that sensor values are visible and dashboard labels still match the reader's parsing rules. |
| Firestore permission or authentication error | Check the service-account key, Firebase project, Firestore availability, and IAM permissions. |
| Firestore timestamp is unchanged | The reader may be skipping unchanged values. Check its logs and browser before treating this as a failure. |
| Firestore updates but Node-RED shows no weather data | Check Node-RED's Firebase connection, collection, document ID, and field mapping. |
| Browser profile is already in use | Stop duplicate reader processes or Chromium instances using `scripts/deltaohm-browser-profile/`. |
| PM2 shows the reader online but data is stale | Inspect reader logs and confirm the browser is still on the visualization page. |

## File Layout

Key project files and local runtime files:

```text
SmartBuildingSystem/
├── config/
│   └── backend.json
├── scripts/
│   ├── deltaohm.js
│   ├── proxy-server.js
│   ├── update-url.js
│   └── deltaohm-browser-profile/    # Generated locally
├── index.html
├── smart-building.webp
├── package.json
├── package-lock.json
├── README.md
├── .gitignore
├── .env                            # Local configuration; do not commit
├── serviceAccountKey.json          # Local Firebase credential; do not commit
├── cloudflared.exe                 # Added locally
└── tunnel.log                      # Generated locally
```

A local `start-tunnel.bat` helper can be kept alongside these files if used.

## Notes

- Keep `config/backend.json` committed so GitHub Pages can serve it.
- Use one primary Windows PC to run the tunnel and URL watcher for this shared frontend.
- Running multiple URL watchers against the same repository can cause the published backend URL to switch between PCs.
- Keep `.env`, Firebase credentials, and browser profile data out of Git.
- Do not share the admin secret with regular users.
- Cloudflare Tunnel provides HTTPS for the public tunnel URL.
- The host PC must remain running and connected to the internet.
- Windows startup configuration restores processes after user sign-in.
- Delta OHM login may still require attention when its session expires.
- The weather reader stores the latest reading rather than historical data.

## External Services and References

- [Node-RED](https://nodered.org/)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [GitHub Pages](https://docs.github.com/en/pages)
- [PM2](https://pm2.keymetrics.io/)
- [Delta OHM Cloud](https://deltaohm.cloud/)
- [Puppeteer](https://pptr.dev/)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Cloud Firestore](https://firebase.google.com/docs/firestore)

## License

The repository's `package.json` declares the ISC license.

This project is provided as-is. Adapt the configuration to your deployment environment.