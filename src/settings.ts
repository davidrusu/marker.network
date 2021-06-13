import { ipcRenderer } from "electron";
import * as $ from "jquery";

import { spinner } from "./nice_stuff";

async function clearCache() {
  await ipcRenderer.invoke("clear-cache");
}

async function logout() {
  await ipcRenderer.invoke("logout");
}

async function unlinkFolder() {
  await ipcRenderer.invoke("unlink-folder");
}

async function unlinkRemarkable() {
  await ipcRenderer.invoke("unlink-remarkable");
}

async function startOver() {
  await ipcRenderer.invoke("start-over");
}

function confirm(msg: string, cb: () => any) {
  $("#confirm-dialog-msg").text(msg);
  $("#confirm-dialog").show();
  $("#confirm-dialog-confirm-btn")
    .off()
    .on("click", async () => {
      await cb();
      window.close();
    });
  $("#confirm-dialog-cancel-btn")
    .off()
    .on("click", () => {
      console.log("Canceled dialog");
      $("#confirm-dialog").hide();
    });
}

$(document).ready(() => {
  $("#clear-cache").on("click", () =>
    confirm("Are you sure you want to clear cache?", clearCache)
  );
  $("#logout").on("click", () =>
    confirm("Are you sure you want to logout?", logout)
  );
  $("#unlink-folder").on("click", () =>
    confirm("Are you sure you want to unlink your folder?", unlinkFolder)
  );
  $("#unlink-remarkable").on("click", () =>
    confirm("Are you sure you want to unlink your device?", unlinkRemarkable)
  );
  $("#start-over").on("click", () =>
    confirm(
      "Are you sure you want to unlink everything and start over?",
      startOver
    )
  );
});
