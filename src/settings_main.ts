import * as fs from "fs/promises";
import * as path from "path";
import * as log from "electron-log";
import { ipcMain, BrowserWindow } from "electron";

import * as constants from "./constants";
import * as main from "./main";

let win: BrowserWindow = null;

async function rm(path: string, options: { recursive: boolean } = undefined) {
  log.info(`Deleting ${path} options: ${options}`);
  await fs
    .rm(path, options)
    .catch((err) =>
      log.error(
        `Error when deleting ${path} opt:${JSON.stringify(options)}`,
        err
      )
    );
}

export function registerHandlers() {
  ipcMain.handle("create-settings-window", createSettingsWindow);

  ipcMain.handle("clear-cache", async () => {
    log.info("Logging out");
    await rm(constants.MATERIAL_PATH, { recursive: true });
    await rm(constants.BUILD_PATH, { recursive: true });
  });

  ipcMain.handle("logout", async () => {
    log.info("Logging out");

    await rm(constants.MARKER_NETWORK_USER_DATA);
  });

  ipcMain.handle("unlink-folder", async () => {
    log.info("Unlinking folder");
    await rm(constants.SITE_CONFIG_PATH);
    await main.appFlow();
  });

  ipcMain.handle("unlink-remarkable", async () => {
    log.info("Unlinking remarkable");
    await rm(constants.DEVICE_TOKEN_PATH);
    await main.appFlow();
  });

  ipcMain.handle("start-over", async () => {
    log.info("Starting over");

    await rm(constants.DEVICE_TOKEN_PATH);
    await rm(constants.MARKER_NETWORK_ALIAS);
    await rm(constants.MARKER_NETWORK_SUB);
    await rm(constants.MARKER_NETWORK_USER_DATA);
    await rm(constants.MATERIAL_PATH, { recursive: true });
    await rm(constants.BUILD_PATH, { recursive: true });
    await main.appFlow();
  });
}

export function createSettingsWindow() {
  destroyWin();

  win = new BrowserWindow({
    width: 400,
    height: 300,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile(path.join(__dirname, "../settings.html"));

  win.on("closed", () => {
    win = null;
  });
}

export function destroyWin() {
  if (!win) return;
  win.close();
  win = null;
}
