import { ipcRenderer } from "electron";
import * as $ from "jquery";
import { spinner } from "./nice_stuff";

function attemptToRegister() {
  const oneTimeCode = $("#one-time-code").val();
  console.log("Attempting to register with OTC: ", oneTimeCode);
  ipcRenderer.invoke("link-device", oneTimeCode).then((resp) => {
    $("#register-spinner").empty();
    if (resp.success) {
      console.log("Success!");
      $("#one-time-code").removeClass("input-error");
    } else {
      console.log("Bad OTC, failed to register");
      $("#one-time-code").addClass("input-error");
      $("#register-error-msg").text(
        "Something's wrong with that code, please double check it and try again"
      );
    }
  });
  $("#register-error-msg").empty();
  $("#register-spinner").empty();
  $("#register-spinner").append(spinner);
}

$(document).ready(() => {
  $(".instructions-content").hide();
  $("#start-registering").click(() => {
    $("#plan-svg").attr("src", "assets/register-step1.svg");
    $("#start-registering").hide();
    $(".instructions-content").show();
  })
  $("#register-btn").click(attemptToRegister);
});
