import { app, BrowserWindow, ipcMain } from "electron";
import * as log from "electron-log";
import * as path from "path";
import * as fs from "fs/promises";
import * as sqlite3 from "better-sqlite3";
import { execFile } from "child_process";
import { Remarkable, ItemResponse } from "remarkable-typescript";
import * as uuid from "uuid";
import { promisify } from "util";
import * as handlebars from "handlebars";

var indexTemplate = handlebars.compile(`
<html>
<head>
</head>
<body>
{{#each pages}}
  <div class="nb-page">
    <img class="nb-page-svg" src="{{this}}"/>
  </div>
{{/each}}
</body>
</html>
`);

const APP_DATA = path.join(app.getPath("appData"), "marker.network");
log.info("APP_DATA", APP_DATA);
fs.mkdir(APP_DATA, { recursive: true }).then(
  () => {},
  (err) => {
    if (err) log.error(`Failed to create APP_DATA: ${APP_DATA}`, err);
  }
);

const db = new sqlite3(path.join(APP_DATA, "marker.db"), {
  verbose: log.info,
});
let rM_CLIENT = new Remarkable();

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

async function linesAreRusty(input: string, output: string) {
  log.info("Running lines-are-rusty with", input, output);
  await fs.mkdir(path.dirname(output), { recursive: true });

  return new Promise((resolve) => {
    let proc = execFile(path.join(__dirname, "lines-are-rusty"), [
      "--no-crop",
      input,
      "-o",
      output,
    ]);
    proc.stdout.on("data", (data) => {
      log.info(`lines-are-rusty output: ${data}`);
    });
    proc.on("exit", (code) => {
      log.info(`lines-are-rusty exited with code ${code}`);
      resolve(output);
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

function appFlow() {
  setupDatabase();
  if (registerDevice()) return;
  if (chooseRootDirectory()) return;
  if (designWebsite()) return;
}

function closeAllWindowsExcept(win: BrowserWindow) {
  BrowserWindow.getAllWindows()
    .filter((w) => w !== win)
    .forEach((window) => window.close());
}

app.on("ready", () => {
  // HACK! for some reason async ipc stalls and this
  // setInterval seems to keep things running.
  // I have no clue what's happening here.
  setInterval(() => {}, 500);
  appFlow();

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
    const deviceToken = await rM_CLIENT.register({ code: otc });
    log.info("Persisting device token", deviceToken);
    persistDeviceToken(deviceToken);
    appFlow();
    return { success: true };
  } catch (error) {
    log.error("Failed to register device", error);
    return { success: false };
  }
});

ipcMain.handle("create-root-directory", async (event, directory) => {
  if (!rM_CLIENT.deviceToken) {
    rM_CLIENT.deviceToken = loadDeviceToken();
    await rM_CLIENT.refreshToken();
  }

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
      persistWebsiteRoot(rootId);
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
  } else {
    log.info("Chosen root is not unique");
    return {
      success: false,
      msg: `Please choose a unique folder name, you already have a folder named '${directory}'`,
    };
  }
});

ipcMain.handle("load-preview", async () => {
  if (!rM_CLIENT.deviceToken) {
    rM_CLIENT.deviceToken = loadDeviceToken();
    await rM_CLIENT.refreshToken();
  }

  log.info("Loading preview");
  let rootId = loadRootDirectory();
  let allItems = await rM_CLIENT.getAllItems();
  let siteItems = allItems.filter((i) => i.Parent === rootId);
  let indexItems = siteItems.filter((i) => i.VissibleName === "Index");
  console.log("Index", indexItems);
  if (indexItems.length > 0) {
    let index = indexItems[0];
    let zip = await rM_CLIENT.downloadZip(index.ID);
    let inputDir = path.join(__dirname, "input");
    await fs.mkdir(inputDir, { recursive: true });
    let indexRawPath = path.join(inputDir, "index-extracted");

    let zipPath = path.join(inputDir, "index.zip");
    await fs.writeFile(zipPath, zip);

    return new Promise((resolve, reject) => {
      let proc = execFile("unzip", ["-o", zipPath, "-d", indexRawPath]);
      proc.stdout.on("data", (data) => {
        log.info(`unzip output: ${data}`);
      });
      proc.on("exit", (code) => {
        log.info(`unzip exited with code ${code}`);
        let indexPageDir = path.join(indexRawPath, index.ID);
        fs.readdir(indexPageDir).then((indexFiles) => {
          log.info("Unzipped index", indexFiles);
          Promise.all(
            indexFiles
              .filter((p) => path.extname(p) === ".rm")
              .map((p) => {
                let page = path.basename(p, ".rm");
                return linesAreRusty(
                  path.join(indexPageDir, p),
                  path.join(__dirname, "generated", "svgs", `index-${page}.svg`)
                );
              })
          ).then(async (ps) => {
            log.info("templating", ps);
            let indexHtml = path.join(__dirname, "generated", "index.html");
            await fs.writeFile(indexHtml, indexTemplate({ pages: ps }));
            resolve(indexHtml);
          });
        });
      });
    });
  } else {
    console.log("No index yet");
  }
});
