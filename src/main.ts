import { app, BrowserWindow, ipcMain } from "electron";
import * as log from "electron-log";
import * as path from "path";
import * as fs from "fs";
import * as sqlite3 from "sqlite3";
import { execFile } from "child_process";
import { Remarkable, ItemResponse } from "remarkable-typescript";

const APP_DATA = path.join(app.getPath("appData"), "marker.network");
log.info("APP_DATA", APP_DATA);
fs.mkdir(APP_DATA, { recursive: true }, (err) => {
  if (err) log.error(`Failed to create APP_DATA: ${APP_DATA}`, err);
});

const db = new sqlite3.Database(path.join(APP_DATA, "marker.db"));
let rM_CLIENT: Remarkable;

function setupDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(
        `
CREATE TABLE IF NOT EXISTS device_tokens (
  device_token TEXT PRIMARY_KEY
)`,
        (err) => {
          if (err) reject(err);
        }
      );

      resolve();
    });
  });
}

function createRegisterWindow() {
  const window = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // and load the index.html of the app.
  window.loadFile(path.join(__dirname, "../register.html"));
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

function registerDevice() {
  return new Promise((resolve, reject) => {
    loadDeviceToken().then(
      (deviceToken) => {
        if (deviceToken) {
          rM_CLIENT = new Remarkable({ deviceToken });
          rM_CLIENT.refreshToken();
          resolve();
        } else {
          rM_CLIENT = new Remarkable();
          createRegisterWindow();
        }
      },
      (err) => {
        log.error("Failed to load device token");
        reject(err);
      }
    );
  });
}

function chooseWebsiteName() {
  log.info("Choosing website name");
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", () => {
  setupDatabase()
    .then(
      () => registerDevice(),
      (err) => log.error(err)
    )
    .then(() => chooseWebsiteName());
  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) registerDevice();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function loadDeviceToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    db.get("SELECT device_token FROM device_tokens LIMIT 1", (err, row) => {
      if (err) {
        log.error("Failed to read device token", err);
        reject(err);
      } else if (row) {
        resolve(row.device_token);
      } else {
        resolve(undefined);
      }
    });
  });
}

function persistDeviceToken(deviceToken: string) {
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO device_tokens(device_token) VALUES (?)",
      deviceToken,
      (err) => {
        if (err) {
          log.error("Failed to write device token", err);
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

ipcMain.handle("link-device", async (event, otc) => {
  try {
    const deviceToken = await rM_CLIENT.register({ code: otc });
    log.info("Persisting device token", deviceToken);
    await persistDeviceToken(deviceToken);
    return { success: true };
  } catch (error) {
    log.error("Failed to register device", error);
    return { success: false };
  }
});
