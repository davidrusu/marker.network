import { ipcRenderer } from "electron";
import * as $ from "jquery";
import { spinner } from "./nice_stuff";

function createRootDirectory() {
  let alias = $("#alias-input").val() as string;
  alias = alias.trim();
  console.log("Selected alias", alias);
  if (alias.length === 0) {
    $("#alias-input").addClass("input-error");
    $("#alias-error-msg")
      .text("Alias name can't be empty")
      .removeClass("hidden");
    return;
  }

  ipcRenderer.invoke("save-site-alias", alias).then((resp) => {
    $("#spinner").empty();
    if (resp.success) {
      console.log("Success!");
      $("#alias-input").removeClass("input-error");
      $("#alias-error-msg").addClass("hidden");
    } else {
      console.log("Failed to reserve alias", resp);
      $("#alias-input").addClass("input-error");
      $("#alias-error-msg").text(resp.msg).removeClass("hidden");
    }
  });
  // ipcRenderer.send("create-alias", directory);
  $("#alias-error-msg").addClass("hidden");
  $("#spinner").empty().append(spinner);
}

$(document).ready(() => {
  $("#create-folder-btn").click(createRootDirectory);
});
