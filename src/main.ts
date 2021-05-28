import { shell, app, BrowserWindow, ipcMain } from "electron";
import * as log from "electron-log";
import * as path from "path";
import * as fs from "fs/promises";
import * as og_fs from "fs";
import { execFile, ChildProcess } from "child_process";
import { Remarkable, ItemResponse } from "remarkable-typescript";
import { createServer } from "http-server";
import * as JSZip from "jszip";
import * as FormData from "form-data";
import axios from "axios";
import { autoUpdater } from "electron-updater";

import * as auth from "./auth";
import * as constants from "./constants";
import * as markerNetworkSub from "./sub";

app.setAppLogsPath(); // Sets the default logging directory

autoUpdater.on("update-downloaded", () => {
  autoUpdater.quitAndInstall();
});
autoUpdater.checkForUpdatesAndNotify();

setInterval(() => {
  log.info("Checking for updates");
  autoUpdater.checkForUpdatesAndNotify();
}, 30 * 60 * 1000); // every 30 minutes

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
  window.webContents.on("new-window", function (e, url) {
    // Open my.remarkable.com links in the users browser of choice
    if (url.indexOf("remarkable.com") > -1) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
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
  window.webContents.on("new-window", function (e, url) {
    // Open marker.network links in the users browser of choice
    if (url.indexOf("marker.network") > -1) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
  return window;
}

function createAliasWindow(user: { id_token: string }): Promise<string> {
  return new Promise((resolve) => {
    const window = new BrowserWindow({
      height: 340,
      width: 460,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });
    window.loadFile(path.join(__dirname, "../choose_alias.html"));
    log.info("Creating save site alias channel");
    ipcMain.handle("save-site-alias", async (event, alias) => {
      try {
        let resp = await reserveSiteAlias(user, alias);
        if (resp.success) {
          await saveAlias(alias);
          resolve(alias);
          window.destroy();
        } else {
          return resp;
        }
      } catch (e) {
        return {
          success: false,
          msg:
            "Something went wrong, please try again. If the problem persists, send me an email at davidrusu.me@gmail.com and we can track down the problem",
        };
      }
    });
    window.on("closed", () => {
      log.info("alias window closed");
      ipcMain.removeHandler("save-site-alias");
    });
  });
}

async function loadDeviceToken(): Promise<string> {
  let deviceToken = await fs.readFile(constants.DEVICE_TOKEN_PATH, "utf-8");
  return deviceToken;
}

async function saveDeviceToken(deviceToken: string): Promise<void> {
  await fs.writeFile(constants.DEVICE_TOKEN_PATH, deviceToken, "utf-8");
}

async function loadSiteConfig(): Promise<{
  site_root: string;
  title: string;
  theme: string;
}> {
  let siteConfigData = await fs.readFile(constants.SITE_CONFIG_PATH, "utf-8");
  return JSON.parse(siteConfigData);
}

async function saveSiteConfig(config: {
  site_root: string;
  title: string;
  theme: string;
}): Promise<void> {
  // We want to ensure we don't corrupt the site_config.json with a failed write.
  //   1. first write to a tmp file
  //   2. atomically rename the tmp file to constants.SITE_CONFIG_PATH after tmp file is written successfully.

  let configString = JSON.stringify(config, null, 2);
  let tempFile = `${constants.SITE_CONFIG_PATH}.tmp`;
  await fs.writeFile(tempFile, configString, "utf-8");
  await fs.rename(tempFile, constants.SITE_CONFIG_PATH);
}

function fixAsarUnpackedPath(path: string): string {
  return path.replace("app.asar", "app.asar.unpacked");
}

function siteGeneratorPath(): string {
  let generatorPath = fixAsarUnpackedPath(
    path.join(__dirname, "marker_network_site_generator")
  );
  log.info("Site Generator Path: ", generatorPath);
  return generatorPath;
}

function generatorProc(args: string[]): ChildProcess {
  return execFile(siteGeneratorPath(), args, {
    cwd: fixAsarUnpackedPath(__dirname),
  });
}

async function siteGeneratorInit(
  siteName: string
): Promise<{
  success: boolean;
  msg: string;
}> {
  log.info("Initializing site with site generator");
  let deviceToken = await loadDeviceToken();
  return new Promise((resolve) => {
    let proc = generatorProc([
      constants.SITE_CONFIG_PATH,
      "init",
      deviceToken,
      siteName,
    ]);
    let stdErr = "";
    proc.stderr.on("data", (data) => {
      stdErr = data;
      log.info(`site-generator stderr: ${data}`);
    });
    proc.stdout.on("data", (data) => {
      log.info(`site-generator stdout: ${data}`);
    });
    proc.on("exit", (exitCode) => {
      log.info(`site-generator exited with code ${exitCode}`);
      resolve({ success: exitCode === 0, msg: stdErr });
    });
  });
}

async function siteGeneratorFetch(): Promise<{
  success: boolean;
  msg: string;
}> {
  log.info(
    "Fetching material with site generator into",
    constants.MATERIAL_PATH
  );
  let deviceToken = await loadDeviceToken();
  return new Promise((resolve) => {
    let proc = generatorProc([
      constants.SITE_CONFIG_PATH,
      "fetch",
      deviceToken,
      constants.MATERIAL_PATH,
    ]);
    let stdErr = "";
    proc.stderr.on("data", (data) => {
      stdErr = data;
      log.info(`site-generator stderr: ${data}`);
    });
    proc.stdout.on("data", (data) => {
      log.info(`site-generator stdout: ${data}`);
    });
    proc.on("exit", (exitCode) => {
      log.info(`site-generator exited with code ${exitCode}`);
      resolve({ success: exitCode === 0, msg: stdErr });
    });
  });
}

async function siteGeneratorGen(): Promise<{
  success: boolean;
  msg: string;
}> {
  log.info(
    "Generating site from",
    constants.MATERIAL_PATH,
    "into",
    constants.BUILD_PATH
  );
  return new Promise((resolve) => {
    let proc = generatorProc([
      constants.SITE_CONFIG_PATH,
      "gen",
      constants.MATERIAL_PATH,
      constants.BUILD_PATH,
    ]);
    let stdErr = "";
    proc.stderr.on("data", (data) => {
      stdErr = data;
      log.info(`site-generator stderr: ${data}`);
    });
    proc.stdout.on("data", (data) => {
      log.info(`site-generator stdout: ${data}`);
    });
    proc.on("exit", (exitCode) => {
      log.info(`site-generator exited with code ${exitCode}`);
      resolve({ success: exitCode === 0, msg: stdErr });
    });
  });
}

async function registerDevice(): Promise<boolean> {
  try {
    let deviceToken = await loadDeviceToken();
    log.info("Found existing device token, skipping registration");
    return false;
  } catch (e) {
    log.info("No device token found, registering device");
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

let designerWin: BrowserWindow = null;
async function designWebsite(): Promise<boolean> {
  log.info("Designing the website");
  designerWin = createDesignWebsiteWindow();
  closeAllWindowsExcept(designerWin);
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

async function saveAlias(alias: string): Promise<void> {
  await fs.writeFile(constants.MARKER_NETWORK_ALIAS, alias, "utf-8");
}

async function loadAlias(): Promise<string> {
  return await fs.readFile(constants.MARKER_NETWORK_ALIAS, "utf-8");
}

async function siteAlias(user: { id_token: string }): Promise<string> {
  try {
    return await loadAlias();
  } catch (e) {
    return await createAliasWindow(user);
  }
}

async function reserveSiteAlias(
  user: { id_token: string },
  alias: string
): Promise<{ success: boolean; msg: string }> {
  log.info("Reserveing site alias", alias);
  let resp = await axios({
    url: `/reserve/${alias}`,
    method: "post",
    headers: { Authorization: `Bearer ${user.id_token}` },
    baseURL: "https://marker.network",
    // baseURL: "http://0.0.0.0:3030",
  });

  if (resp.status == 201) {
    log.info("Received successful reserve response from marker.network");
    return { success: true, msg: "Alias has been reserved" };
  } else {
    log.info("Received failed reserve response from marker.network", resp);
    return { success: false, msg: resp.data };
  }
}

async function verifySubscription(user: string): Promise<boolean> {
  if (!(await og_fs.existsSync(constants.MARKER_NETWORK_SUB))) {
    let checkoutSession = await markerNetworkSub.createCheckoutSession(user);
    if (checkoutSession) {
      let subbed = await markerNetworkSub.createCheckoutWindow(checkoutSession);
      if (subbed) {
        await fs.writeFile(constants.MARKER_NETWORK_SUB, "xxx", "utf-8");
        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  } else {
    return true;
  }
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
    let { success, msg } = await siteGeneratorInit(rMFolderName);

    if (success) {
      appFlow();

      return {
        success,
        msg: "Site folder was initialized on your device",
      };
    } else {
      return { success, msg };
    }
  } catch (e) {
    log.error("Failed to create directory", e);
    return {
      success: false,
      msg: `Failed to initialize site, got error ${e}`,
    };
  }
});

let server = createServer({ root: constants.BUILD_PATH });
let URL = "127.0.0.1";
server.listen(0, URL);

ipcMain.handle("load-preview", async () => {
  log.info("Loading preview");
  let { success, msg } = await siteGeneratorFetch();

  if (success) {
    let { success, msg } = await siteGeneratorGen();

    if (success) {
      let s = ((server as unknown) as { server: any }).server;
      let port = s.address().port;
      let nonce = Math.floor(Date.now() / 1000);
      if (designerWin && !designerWin.isDestroyed()) {
        // sometimes aggressive browser caching prevents the iframe from reloading
        await designerWin.webContents.session.clearCache();
      }
      return {
        success,
        msg: "finished generating site",
        url: `http://${URL}:${port}?${nonce}`,
      };
    } else {
      log.info("Failed to complete gen", msg);
      return { success, msg };
    }
  } else {
    log.info("Failed to complete fetch", msg);
    return { success, msg };
  }
});

ipcMain.handle("load-site-config", async () => {
  log.info("Loading site config");
  let config: any = await loadSiteConfig();
  try {
    let alias = await loadAlias();
    config.alias = alias;
  } catch (e) {
    config.alias = null;
  }
  return config;
});

ipcMain.handle("save-site-config", async (event, config) => {
  log.info("Saving site config", config);
  let validatedConfig = {
    title: config.title,
    theme: config.theme,
    site_root: config.site_root,
  };
  return saveSiteConfig(validatedConfig);
});

ipcMain.handle("publish", async (event) => {
  log.info("Publishing site");

  let user = await auth.login();

  // TODO: Figure out how to fund this work
  // let subbed = await verifySubscription(user.id_token);
  // if (!subbed) {
  //   return 0;
  // }

  let alias = await siteAlias(user);
  log.info("Publishing to alias", alias);
  let zip = JSZip();

  let config = await loadSiteConfig();
  zip.file("config.json", JSON.stringify(config));

  let manifest = await fs.readFile(
    path.join(constants.MATERIAL_PATH, "manifest.json"),
    "utf-8"
  );

  zip.file("manifest.json", manifest);

  let zips = await fs.readdir(path.join(constants.MATERIAL_PATH, "zip"));
  for (const notebook_zip of zips) {
    log.info("zipping", notebook_zip);
    let zipData = await fs.readFile(
      path.join(constants.MATERIAL_PATH, "zip", notebook_zip)
    );
    zip.file(`zip/${notebook_zip}`, zipData);
  }

  log.info("finished building zip, starting upload");
  let marker_network_zip = path.join(constants.APP_DATA, "marker_network.zip");

  return new Promise((resolve) => {
    zip
      .generateNodeStream({ streamFiles: true })
      .pipe(og_fs.createWriteStream(marker_network_zip))
      .on("finish", async () => {
        console.log(`${marker_network_zip} written.`);

        var form = new FormData();
        form.append("file", og_fs.createReadStream(marker_network_zip));
        form.submit(
          {
            protocol: "https:",
            host: "marker.network",
            path: `/upload/${alias}`,
            headers: { Authorization: `Bearer ${user.id_token}` },
          },
          function (err, res) {
            log.info("upload result", err, res.statusCode);
            resolve(res.statusCode);
          }
        );
      });
  });
});
