import { app, BrowserWindow } from "electron";
import * as log from "electron-log";
import * as path from "path";
import * as fs from "fs";
import * as sqlite3 from "sqlite3";

const APP_DATA = path.join(app.getPath("appData"), "marker.network");
log.info("APP_DATA", APP_DATA);

fs.mkdir(APP_DATA, { recursive: true }, (err) => {
  if (err) {
    log.error("Failed to create APP_DATA directory", APP_DATA, err);
  }
});

const db = new sqlite3.Database(path.join(APP_DATA, "marker.db"));

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, "../index.html"));
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", () => {
  createWindow();

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
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

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
