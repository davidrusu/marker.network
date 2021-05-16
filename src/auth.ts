import * as fs from "fs/promises";
import * as path from "path";
import * as url from "url";
import * as log from "electron-log";
import { BrowserWindow } from "electron";
import { AuthenticationClient } from "auth0";

import * as constants from "./constants";

const AUTH0_DOMAIN = "marker-network.us.auth0.com";
const AUTH0_CLIENT_ID = "IEVrFbq9ZmPvWLMXS78IcWsqznlB995n";
const REDIRECT_URI = "http://localhost/callback";

const auth0 = new AuthenticationClient({
  domain: AUTH0_DOMAIN,
  clientId: AUTH0_CLIENT_ID,
});

const AUTH_URL =
  "https://" +
  AUTH0_DOMAIN +
  "/authorize?" +
  "scope=openid profile offline_access&" +
  "response_type=code&" +
  "client_id=" +
  AUTH0_CLIENT_ID +
  "&" +
  "redirect_uri=" +
  REDIRECT_URI;

let win: BrowserWindow = null;

async function loadUserData(): Promise<{
  refresh_token: string;
  id_token: string;
}> {
  let userData = await fs.readFile(constants.MARKER_NETWORK_USER_DATA, "utf-8");
  return JSON.parse(userData);
}

async function saveUserData(userData: object): Promise<void> {
  // We want to ensure we don't corrupt any existing user data with a failed write.
  //   1. first write to a tmp file
  //   2. atomically rename the tmp file to constants.MARKER_NETWORK_USER_DATA after tmp file is written successfully.

  let userDataString = JSON.stringify(userData, null, 2);
  let tempFile = `${constants.MARKER_NETWORK_USER_DATA}.tmp`;
  await fs.writeFile(tempFile, userDataString, "utf-8");
  await fs.rename(tempFile, constants.MARKER_NETWORK_USER_DATA);
}

async function deleteUserData(): Promise<void> {
  await fs
    .rm(constants.MARKER_NETWORK_USER_DATA)
    .catch((err) => log.error("Error when deleting user data", err));
}

export async function logout(): Promise<void> {
  log.info("Logging out");
  await deleteUserData();
}

export async function login(): Promise<{
  refresh_token: string;
  id_token: string;
}> {
  try {
    let userData = await loadUserData();
    return new Promise((resolve, reject) => {
      try {
        auth0.refreshToken(
          { refresh_token: userData.refresh_token },
          (err, refreshedUserData) => {
            if (err) {
              log.error("Error refreshing token", err);
              logout();
              reject(err);
            } else {
              log.info("Refreshed token", refreshedUserData);
              // refreshedUserData does not have a refresh_token, merge it into userData
              saveUserData(Object.assign(userData, refreshedUserData));
              resolve(userData as { refresh_token: string; id_token: string });
            }
          }
        );
      } catch (err) {
        log.info("Error refreshing token", err);
        logout();
        reject(err);
      }
    });
  } catch (e) {
    // user data is likely bad, delete it and let the user re-log in
    await logout();
    return await createAuthWindow();
  }
}

function createAuthWindow(): Promise<{
  refresh_token: string;
  id_token: string;
}> {
  return new Promise((resolve, reject) => {
    destroyAuthWin();

    win = new BrowserWindow({
      width: 1000,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        enableRemoteModule: false,
      },
    });

    log.info("Auth URL", AUTH_URL);
    win.loadURL(AUTH_URL);

    const {
      session: { webRequest },
    } = win.webContents;

    const filter = {
      urls: [`${REDIRECT_URI}*`],
    };

    webRequest.onBeforeRequest(filter, async ({ url: callbackUrl }) => {
      const urlParts = url.parse(callbackUrl, true);
      const query = urlParts.query;
      const options = {
        code: query.code as string,
        redirect_uri: REDIRECT_URI,
      };
      auth0.oauth.authorizationCodeGrant(options, (err, userData) => {
        if (err) {
          log.error("Error while authorizing code grant", err);
          reject(err);
        } else {
          log.info("Got user data", userData);
          saveUserData(userData);
          destroyAuthWin();
          resolve(
            (userData as unknown) as { refresh_token: string; id_token: string }
          );
        }
      });
    });

    win.on("authenticated" as any, () => {
      destroyAuthWin();
    });

    win.on("closed", () => {
      win = null;
    });
  });
}

function destroyAuthWin() {
  if (!win) return;
  win.close();
  win = null;
}
