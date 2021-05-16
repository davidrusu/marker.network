import { ipcRenderer } from "electron";
import * as $ from "jquery";

import { spinner } from "./nice_stuff";

function publishDesigner() {
  console.log("publishing");
  ipcRenderer.invoke("publish").then((publish_resp) => {
    console.log("Publish Response", publish_resp);
  });
}

function reloadDesigner() {
  console.log("reloading");
  $("#designer-reload").prop("disabled", true);
  setTimeout(() => $("#designer-reload").prop("disabled", false), 5000);

  $("#preview-loading").append(spinner);
  ipcRenderer.invoke("load-preview").then((preview_resp) => {
    console.log("Got preview response:", preview_resp);
    $("#preview-frame").attr("src", preview_resp.url);
    $("#preview-loading").empty();
    $("#designer-reload").prop("disabled", false);
  });
}

let CONFIG = { title: "" };
async function saveSiteConfig() {
  CONFIG.title = $("#site-title-input").val() as string;
  await ipcRenderer.invoke("save-site-config", CONFIG);
  await reloadDesigner();
}

reloadDesigner();

ipcRenderer.invoke("load-site-config").then((config) => {
  CONFIG = config;
  console.log("Got site config", config);
  $(document).ready(() => {
    $("#designer-reload").click(reloadDesigner);
    $("#designer-publish").click(publishDesigner);
    $("#site-title-input").val(config.title);
    $("#site-title-input").on("change", saveSiteConfig);
  });
});
