import { app, BrowserWindow, ipcMain } from "electron";
import * as log from "electron-log";
import * as path from "path";
import * as fs from "fs/promises";
import * as sqlite3 from "better-sqlite3";
import { execFile } from "child_process";
import { Remarkable, ItemResponse } from "remarkable-typescript";
import * as uuid from "uuid";
import { promisify } from "util";

const APP_DATA = path.join(app.getPath("appData"), "marker.network");

fs.mkdir(APP_DATA, { recursive: true }).then(
  () => log.info("APP_DATA", APP_DATA),
  (err) => log.error(`Failed to create APP_DATA: ${APP_DATA}`, err)
);

const db = new sqlite3(path.join(APP_DATA, "marker.db"), {
  verbose: log.info,
});

let rM = new Remarkable();

function setupDatabase() {
  db.exec(`
CREATE TABLE IF NOT EXISTS device_tokens (
  id INTEGER PRIMARY KEY,
  device_token TEXT NOT NULL
)`);

  db.exec(`
CREATE TABLE IF NOT EXISTS websites (
  root_id String,
  device_token_id INTEGER,
  FOREIGN KEY(device_token_id) REFERENCES device_tokens(id)
)`);
}

function createRegisterWindow(): BrowserWindow {
  const window = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  window.loadFile(path.join(__dirname, "../register.html"));
  return window;
}

function createChooseFolderWindow(): BrowserWindow {
  const window = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  window.loadFile(path.join(__dirname, "../choose_root_directory.html"));
  return window;
}

function createDesignWebsiteWindow(): BrowserWindow {
  const window = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  window.loadFile(path.join(__dirname, "../designer.html"));
  return window;
}

function materialPath(): string {
  return path.join(APP_DATA, "material");
}

function siteConfigPath(): string {
  return path.join(APP_DATA, "site_config.json");
}

async function loadSiteConfig(): Promise<{
  site_root: string;
  title: string;
  theme: string;
}> {
  let siteConfigData = await fs.readFile(siteConfigPath(), "utf-8");
  return JSON.parse(siteConfigData);
}

async function saveSiteConfig(config: {
  site_root: string;
  title: string;
  theme: string;
}): Promise<void> {
  let configString = JSON.stringify(config, null, 2);
  let tempFile = `${siteConfigPath()}.tmp`;
  await fs.writeFile(tempFile, configString, "utf-8");
  await fs.rename(tempFile, siteConfigPath());
}

async function siteGeneratorInit(siteName: string): Promise<number> {
  log.info("Initializing site with site generator into", materialPath());
  let deviceToken = loadDeviceToken();
  return new Promise((resolve) => {
    let proc = execFile(
      path.join(__dirname, "marker-network-site-generator"),
      [siteConfigPath(), "init", deviceToken, siteName],
      { cwd: __dirname }
    );
    proc.stderr.on("data", (data) => {
      log.info(`site-generator stderr: ${data}`);
    });
    proc.stdout.on("data", (data) => {
      log.info(`site-generator stdout: ${data}`);
    });
    proc.on("exit", (exitCode) => {
      log.info(`site-generator exited with code ${exitCode}`);
      resolve(exitCode);
    });
  });
}

async function siteGeneratorFetch(): Promise<number> {
  log.info("Fetching material with site generator into", materialPath());
  let deviceToken = loadDeviceToken();
  return new Promise((resolve) => {
    let proc = execFile(path.join(__dirname, "marker-network-site-generator"), [
      siteConfigPath(),
      "fetch",
      deviceToken,
      materialPath(),
    ]);
    proc.stderr.on("data", (data) => {
      log.info(`site-generator stderr: ${data}`);
    });
    proc.stdout.on("data", (data) => {
      log.info(`site-generator stdout: ${data}`);
    });
    proc.on("exit", (exitCode) => {
      log.info(`site-generator exited with code ${exitCode}`);
      resolve(exitCode);
    });
  });
}

function registerDevice(): boolean {
  let deviceToken = loadDeviceToken();
  if (deviceToken) {
    return false;
  } else {
    let win = createRegisterWindow();
    closeAllWindowsExcept(win);
    return true;
  }
}

async function setupSiteConfig(): Promise<boolean> {
  log.info("Choosing root directory");
  try {
    let siteConfig = await loadSiteConfig();
    log.info("Found existing site config, skipping setup", siteConfig);
    return false;
  } catch (e) {
    log.info("No site config, going through site config setup");
    let win = createChooseFolderWindow();
    closeAllWindowsExcept(win);
    return true;
  }
}

function designWebsite(): boolean {
  log.info("Designing the website");
  let win = createDesignWebsiteWindow();
  closeAllWindowsExcept(win);
  return true;
}

async function appFlow() {
  setupDatabase();
  if (registerDevice()) return;
  if (await setupSiteConfig()) return;
  if (designWebsite()) return;
}

function closeAllWindowsExcept(win: BrowserWindow) {
  BrowserWindow.getAllWindows()
    .filter((w) => w !== win)
    .forEach((window) => window.close());
}

app.on("ready", async () => {
  // HACK! for some reason async ipc stalls and this
  // setInterval seems to keep things running.
  // I have no clue what's happening here.
  setInterval(() => {}, 500);
  await appFlow();

  app.on("activate", () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) appFlow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  log.info("Got window-all-closed event");
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function loadDeviceToken(): string {
  let row = db.prepare("SELECT device_token FROM device_tokens").get();
  if (row) {
    return row.device_token;
  } else {
    return undefined;
  }
}

function loadDeviceTokenId(deviceToken: string): Promise<number> {
  let row = db
    .prepare(
      "SELECT id as device_token_id FROM device_tokens WHERE device_token = ?"
    )
    .get(deviceToken);
  if (row) {
    log.info("Got device token id", row.device_token_id);
    return row.device_token_id;
  } else {
    return undefined;
  }
}

function persistDeviceToken(deviceToken: string) {
  db.prepare("INSERT INTO device_tokens(device_token) VALUES (?)").run(
    deviceToken
  );
}

function loadRootDirectory(): string {
  let deviceTokenId = loadDeviceTokenId(loadDeviceToken());
  let row = db
    .prepare("SELECT root_id FROM websites WHERE device_token_id = ?")
    .get(deviceTokenId);
  if (row) {
    log.info("Got root directory fromdb", row.root_id);
    return row.root_id;
  } else {
    log.error("No root directory to get");
    return undefined;
  }
}

function persistWebsiteRoot(directoryId: string) {
  let deviceTokenId = loadDeviceTokenId(loadDeviceToken());
  db.prepare(
    "INSERT INTO websites(device_token_id, root_id) VALUES (?, ?)"
  ).run(deviceTokenId, directoryId);
}

ipcMain.handle("link-device", async (event, otc) => {
  try {
    const deviceToken = await rM.register({ code: otc });
    log.info("Persisting device token", deviceToken);
    persistDeviceToken(deviceToken);
    appFlow();
    return { success: true };
  } catch (error) {
    log.error("Failed to register device", error);
    return { success: false };
  }
});

ipcMain.handle("init-site", async (event, rMFolderName) => {
  let norm = (s: string) => s.trim().replace("  ", " ");
  let normed = norm(rMFolderName);
  while (normed !== rMFolderName) {
    rMFolderName = normed;
    normed = norm(rMFolderName);
  }

  try {
    log.info("Creating site folder on device", rMFolderName);
    await siteGeneratorInit(rMFolderName);

    appFlow();

    return {
      success: true,
      msg: "Directory was created on your device",
    };
  } catch (e) {
    log.error("Failed to create directory", e);
    return {
      success: false,
      msg: `Failed to create directory, got error from reMarkable cloud API ${e}`,
    };
  }
});

ipcMain.handle("load-preview", async () => {
  log.info("Loading preview");
  let exitCode = await siteGeneratorFetch();
  log.info(`Finished fetch exit=${exitCode}`);
});
