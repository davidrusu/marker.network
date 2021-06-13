import { ipcRenderer } from "electron";
import * as $ from "jquery";

async function confirm() {
  await ipcRenderer.invoke("confirm-tos-warning");
}

async function decline() {
  await ipcRenderer.invoke("decline-tos-warning");
}

$(document).ready(() => {
  $("#confirm-btn").on("click", confirm);
  $("#decline-btn").on("click", decline);
});
