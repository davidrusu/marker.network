import { app, BrowserWindow, ipcMain } from "electron";
import * as log from "electron-log";
import * as path from "path";
import * as fs from "fs/promises";
import { execFile } from "child_process";
import { Remarkable, ItemResponse } from "remarkable-typescript";
import * as uuid from "uuid";
import { promisify } from "util";

const APP_DATA = path.join(app.getPath("appData"), "marker.network");

const MATERIAL_PATH = path.join(APP_DATA, "material");
const DEVICE_TOKEN_PATH = path.join(APP_DATA, "device_token");
const SITE_CONFIG_PATH = path.join(APP_DATA, "site_config.json");

fs.mkdir(APP_DATA, { recursive: true }).then(
  () => log.info("APP_DATA", APP_DATA),
  (err) => log.error(`Failed to create APP_DATA: ${APP_DATA}`, err)
);

let rM = new Remarkable();

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

async function loadDeviceToken(): Promise<string> {
  let deviceToken = await fs.readFile(DEVICE_TOKEN_PATH, "utf-8");
  return deviceToken;
}

async function saveDeviceToken(deviceToken: string): Promise<void> {
  await fs.writeFile(DEVICE_TOKEN_PATH, deviceToken, "utf-8");
}

async function loadSiteConfig(): Promise<{
  site_root: string;
  title: string;
  theme: string;
}> {
  let siteConfigData = await fs.readFile(SITE_CONFIG_PATH, "utf-8");
  return JSON.parse(siteConfigData);
}

async function saveSiteConfig(config: {
  site_root: string;
  title: string;
  theme: string;
}): Promise<void> {
  // We want to ensure we don't corrupt the site_config.json with a failed write.
  //   1. first write to a tmp file
  //   2. atomically rename the tmp file to SITE_CONFIG_PATH after tmp file is written successfully.

  let configString = JSON.stringify(config, null, 2);
  let tempFile = `${SITE_CONFIG_PATH}.tmp`;
  await fs.writeFile(tempFile, configString, "utf-8");
  await fs.rename(tempFile, SITE_CONFIG_PATH);
}

async function siteGeneratorInit(siteName: string): Promise<number> {
  log.info("Initializing site with site generator");
  let deviceToken = await loadDeviceToken();
  return new Promise((resolve) => {
    let proc = execFile(
      path.join(__dirname, "marker-network-site-generator"),
      [SITE_CONFIG_PATH, "init", deviceToken, siteName],
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
  log.info("Fetching material with site generator into", MATERIAL_PATH);
  let deviceToken = await loadDeviceToken();
  return new Promise((resolve) => {
    let proc = execFile(path.join(__dirname, "marker-network-site-generator"), [
      SITE_CONFIG_PATH,
      "fetch",
      deviceToken,
      MATERIAL_PATH,
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

async function registerDevice(): Promise<boolean> {
  let deviceToken = await loadDeviceToken();
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

async function designWebsite(): Promise<boolean> {
  log.info("Designing the website");
  let win = createDesignWebsiteWindow();
  closeAllWindowsExcept(win);
  return true;
}

async function appFlow() {
  if (await registerDevice()) return;
  if (await setupSiteConfig()) return;
  if (await designWebsite()) return;
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

  app.on("activate", async () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      await appFlow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  log.info("All windows closed");
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("link-device", async (event, otc) => {
  try {
    const deviceToken = await rM.register({ code: otc });
    log.info("Saving device token", deviceToken);
    await saveDeviceToken(deviceToken);
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
