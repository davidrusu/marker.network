import { ipcRenderer } from "electron";
import * as $ from "jquery";

function createRootDirectory() {
  const directory = $("#root-directory-input").val();
  console.log("Creating root directory", directory);
  // TODO: validate directory name

  ipcRenderer.invoke("create-root-directory", directory).then((resp) => {
    $("#directory-spinner").addClass("hidden");
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
  $("#directory-spinner").removeClass("hidden");
}

$(document).ready(() => {
  $("#root-directory-input").on("change", createRootDirectory);
});
