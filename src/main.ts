import { app, BrowserWindow, ipcMain } from "electron";
import * as log from "electron-log";
import * as path from "path";
import * as fs from "fs";
import * as sqlite3 from "better-sqlite3";
import { execFile } from "child_process";
import { Remarkable, ItemResponse } from "remarkable-typescript";
import * as uuid from "uuid";
import { promisify } from "util";

const APP_DATA = path.join(app.getPath("appData"), "marker.network");
log.info("APP_DATA", APP_DATA);
fs.mkdir(APP_DATA, { recursive: true }, (err) => {
  if (err) log.error(`Failed to create APP_DATA: ${APP_DATA}`, err);
});

const db = new sqlite3(path.join(APP_DATA, "marker.db"), {
  verbose: log.info,
});
let rM_CLIENT: Remarkable;

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

function createRootDirectoryWindow(): BrowserWindow {
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

function linesAreRusty() {
  let proc = execFile(path.join(__dirname, "lines-are-rusty"), ["--help"]);
  proc.stdout.on("data", (data) => {
    log.info(`lines-are-rusty output: ${data}`);
  });
  proc.on("exit", (code) => {
    log.info(`lines-are-rusty exited with code ${code}`);
  });
}

async function registerDevice(): Promise<boolean> {
  let deviceToken = loadDeviceToken();
  if (deviceToken) {
    rM_CLIENT = new Remarkable({ deviceToken });
    await rM_CLIENT.refreshToken();
    return false;
  } else {
    rM_CLIENT = new Remarkable();
    let win = createRegisterWindow();
    closeAllWindowsExcept(win);
    return true;
  }
}

function chooseRootDirectory(): boolean {
  log.info("Choosing root directory");
  let rootDir = loadRootDirectory();
  if (rootDir) {
    log.info("Directory", rootDir);
    return false;
  } else {
    log.info("No root directory, prompting user to choose one");
    let win = createRootDirectoryWindow();
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
  if (await registerDevice()) return;
  if (chooseRootDirectory()) return;
  if (designWebsite()) return;
}

function closeAllWindowsExcept(win: BrowserWindow) {
  BrowserWindow.getAllWindows()
    .filter((w) => w !== win)
    .forEach((window) => window.close());
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", async () => {
  await appFlow();

  app.on("activate", async () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) await appFlow();
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

function loadDeviceTokenId(): Promise<number> {
  let row = db
    .prepare(
      "SELECT id as device_token_id FROM device_tokens WHERE device_token = ?"
    )
    .get(rM_CLIENT.deviceToken);
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
  let deviceTokenId = loadDeviceTokenId();
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
  let deviceTokenId = loadDeviceTokenId();
  db.prepare(
    "INSERT INTO websites(device_token_id, root_id) VALUES (?, ?)"
  ).run(deviceTokenId, directoryId);
}

ipcMain.handle("link-device", async (event, otc) => {
  try {
    const deviceToken = await rM_CLIENT.register({ code: otc });
    log.info("Persisting device token", deviceToken);
    await persistDeviceToken(deviceToken);
    await appFlow();
    return { success: true };
  } catch (error) {
    log.error("Failed to register device", error);
    return { success: false };
  }
});

ipcMain.handle("create-root-directory", async (event, directory) => {
  let norm = (s: string) => s.trim().replace("  ", " ");
  let normed = norm(directory);
  while (normed !== directory) {
    directory = normed;
    normed = norm(directory);
  }

  log.info("Creating root directory on device", directory);

  // Check if a root directory with this name already exists.
  let allItems = await rM_CLIENT.getAllItems();
  let rootFolders = allItems
    .filter((i) => i.Parent === "")
    .filter((i) => i.Type === "CollectionType");
  log.info("Inspecting root folders for directory:", rootFolders, directory);

  if (rootFolders.every((i) => i.VissibleName !== directory)) {
    // No directories with this name exist, creating it now.
    try {
      let directoryId = uuid.v4();
      log.info("Creating directory under ID", directoryId);
      let rootId = await rM_CLIENT.createDirectory(directory, directoryId);
      // rootId is the same as directoryId
      await persistWebsiteRoot(rootId);
      await appFlow();
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
  } else {
    log.info("Chosen root is not unique");
    return {
      success: false,
      msg: `Please choose a unique folder name, you already have a folder named '${directory}'`,
    };
  }
});
