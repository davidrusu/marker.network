import { ipcRenderer } from "electron";
import * as $ from "jquery";
import { spinner } from "./nice_stuff";

function createRootDirectory() {
  let directory = $("#root-directory-input").val() as string;
  directory = directory.trim();
  console.log("Creating root directory", directory);
  if (directory.length === 0) {
    $("#root-directory-input").addClass("input-error");
    $("#root-directory-error-msg")
      .text("Folder name can't be empty")
      .removeClass("hidden");
    return;
  }

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
  $("#create-folder-btn").click(createRootDirectory);
});
