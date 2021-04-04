import { ipcRenderer } from "electron";
import * as $ from "jquery";

import { spinner } from "./nice_stuff";

function publishDesigner() {
  console.log("publishing");
}

function reloadDesigner() {
  console.log("reloading");
  $("#designer-reload").prop("disabled", true);
  setTimeout(() => $("#designer-reload").prop("disabled", false), 5000);
  ipcRenderer.invoke("load-preview");
}

$(document).ready(() => {
  $("#designer-reload").click(reloadDesigner);
  $("#designer-publish").click(publishDesigner);
});