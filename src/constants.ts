import * as fs from "fs/promises";
import * as path from "path";

import { app } from "electron";
import * as log from "electron-log";

export const APP_DATA = path.join(app.getPath("appData"), "marker.network");
export const CONFIRM_TOS_WARNING_PATH = path.join(
  APP_DATA,
  "confirmed_tos_warning"
);
export const MATERIAL_PATH = path.join(APP_DATA, "material");
export const BUILD_PATH = path.join(APP_DATA, "build");
export const DEVICE_TOKEN_PATH = path.join(APP_DATA, "device_token");
export const SITE_CONFIG_PATH = path.join(APP_DATA, "site_config.json");
export const MARKER_NETWORK_ALIAS = path.join(APP_DATA, "marker_network_alias");
export const MARKER_NETWORK_SUB = path.join(APP_DATA, "marker_network_sub");
export const MARKER_NETWORK_USER_DATA = path.join(
  APP_DATA,
  "marker_network_user_data"
);

fs.mkdir(APP_DATA, { recursive: true }).then(
  () => log.info("APP_DATA", APP_DATA),
  (err) => log.error(`Failed to create APP_DATA: ${APP_DATA}`, err)
);
