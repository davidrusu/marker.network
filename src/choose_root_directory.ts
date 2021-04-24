import { ipcRenderer } from "electron";
import * as $ from "jquery";
import { spinner } from "./nice_stuff";

function createRootDirectory() {
  const directory = $("#root-directory-input").val();
  console.log("Creating root directory", directory);
  // TODO: validate directory name

  ipcRenderer.invoke("init-site", directory).then((resp) => {
    $("#directory-spinner").empty();
    if (resp.success) {
      console.log("Success!");
      $("#root-directory-input").removeClass("input-error");
      $("#root-directory-error-msg").addClass("hidden");
    } else {
      console.log("Failed to create root", resp);
      $("#root-directory-input").addClass("input-error");
      $("#root-directory-error-msg").text(resp.msg).removeClass("hidden");
    }
  });
  // ipcRenderer.send("create-root-directory", directory);
  $("#root-directory-error-msg").addClass("hidden");
  $("#directory-spinner").empty().append(spinner);
}

$(document).ready(() => {
  $("#root-directory-input").on("change", createRootDirectory);
});
