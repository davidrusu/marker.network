import { ipcRenderer } from "electron";
import * as $ from "jquery";

function attemptToRegister() {
  const oneTimeCode = $("#one-time-code").val();
  console.log("Attempting to register with OTC: ", oneTimeCode);
  ipcRenderer.invoke("link-device", oneTimeCode).then((resp) => {
    $("#register-spinner").addClass("hidden");
    if (resp.success) {
      console.log("Success!");
      $("#one-time-code").removeClass("input-error");
    } else {
      console.log("Bad OTC, failed to register");
      $("#one-time-code").addClass("input-error");
    }
  });
  $("#register-spinner").removeClass("hidden");
}

$(document).ready(() => {
  $("#one-time-code").on("change", attemptToRegister);
});
