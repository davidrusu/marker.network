import { ipcRenderer } from "electron";
import * as $ from "jquery";

import { spinner } from "./nice_stuff";

function publishDesigner() {
  console.log("publishing");
  $("#preview-loading").append(spinner);
  ipcRenderer.invoke("publish").then(async (publish_resp) => {
    await loadConfig();
    console.log("Publish Response", publish_resp);
    $("#preview-loading").empty();
    $("#marker-network-site-link").addClass("live-btn");
    setTimeout(
      () => $("#marker-network-site-link").removeClass("live-btn"),
      5000
    );
  });
}

function reloadDesigner() {
  console.log("reloading");
  $("#designer-reload").prop("disabled", true);
  setTimeout(() => $("#designer-reload").prop("disabled", false), 3000);

  $("#preview-loading").append(spinner);
  ipcRenderer.invoke("load-preview").then((preview_resp) => {
    console.log("Got preview response:", preview_resp);
    $("#preview-frame").attr("src", preview_resp.url);
    $("#preview-loading").empty();
    $("#designer-reload").prop("disabled", false);
  });
}

let CONFIG: { title: string; alias: string } = { title: "", alias: null };
async function saveSiteConfig() {
  CONFIG.title = $("#site-title-input").val() as string;
  await ipcRenderer.invoke("save-site-config", CONFIG);
  await reloadDesigner();
}

reloadDesigner();

async function loadConfig(): Promise<void> {
  return new Promise((resolve) => {
    ipcRenderer.invoke("load-site-config").then((config) => {
      console.log("Got site config", config);
      CONFIG = config;
      $("#site-title-input").val(CONFIG.title);
      if (CONFIG.alias) {
        let marker_network_site_alias = `marker.network/@${CONFIG.alias}`;
        $("#marker-network-site-link")
          .removeClass("hidden")
          .attr("href", `https://${marker_network_site_alias}`)
          .text(marker_network_site_alias);
      } else {
        $("#marker-network-site-link").addClass("hidden");
      }
      resolve();
    });
  });
}

loadConfig().then(() => {
  $(document).ready(() => {
    $("#designer-reload").click(reloadDesigner);
    $("#designer-publish").click(publishDesigner);
    $("#site-title-input").on("change", saveSiteConfig);
  });
});
