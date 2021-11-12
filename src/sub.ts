import * as path from "path";

import axios from "axios";
import { BrowserWindow } from "electron";

const SUCCESS_URL = "http://localhost/success";
const CANCEL_URL = "http://localhost/cancel";

export async function createCheckoutSession(user: string): Promise<string> {
  const resp = await axios({
    url: `/stripe_checkout_session`,
    method: "post",
    headers: { Authorization: `Bearer ${user}` },
    baseURL: "https://marker.network",
    // baseURL: "http://0.0.0.0:3030",
  });

  if (resp.status == 201) {
    return resp.data;
  } else {
    return null;
  }
}

let win: BrowserWindow = null;
export function createCheckoutWindow(
  checkoutSessionId: string
): Promise<boolean> {
  return new Promise((resolve) => {
    destroySubWin();

    win = new BrowserWindow({
      width: 1000,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
      },
    });

    win.loadFile(path.join(__dirname, "../sub.html"), {
      query: { checkoutSessionId: checkoutSessionId },
    });

    const {
      session: { webRequest },
    } = win.webContents;

    const filter = {
      urls: [`${SUCCESS_URL}*`, `${CANCEL_URL}*`],
    };

    let resolved = false;

    webRequest.onBeforeRequest(filter, async ({ url: callbackUrl }) => {
      console.log(callbackUrl);
      resolved = true;
      destroySubWin();
      resolve(callbackUrl.indexOf(SUCCESS_URL) >= 0);
    });

    win.on("closed", () => {
      if (!resolved) {
        resolve(false);
      }
      win = null;
    });
  });
}

function destroySubWin() {
  if (!win) return;
  win.close();
  win = null;
}
