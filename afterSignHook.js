const fs = require("fs");
const path = require("path");

var electron_notarize = require("electron-notarize");

require("dotenv").config();

module.exports = async function (params) {
  // Only notarize the app on Mac OS only.
  if (process.platform !== "darwin") {
    return;
  }
  console.log("afterSign hook triggered", params);
  // Same appId in electron-builder.
  let appId = "network.marker.Designer";
  let appPath = path.join(
    params.appOutDir,
    `${params.packager.appInfo.productFilename}.app`
  );
  if (!fs.existsSync(appPath)) {
    throw new Error(`Cannot find application at: ${appPath}`);
  }
  console.log(`Notarizing ${appId} found at ${appPath}`);
  try {
    await electron_notarize.notarize({
      appBundleId: appId,
      appPath: appPath,
      appleId: process.env.APPLE_ID, // this is your apple ID it should be stored in an .env file
      appleIdPassword: process.env.APPLE_ID_PASS, // this is NOT your apple ID password. You need to
      //create an application specific password from https://appleid.apple.com under "security" you can generate
      //such a password
      // ascProvider: process.env.appleIdProvider // this is only needed if you have multiple developer
      // profiles linked to your apple ID.
    });
  } catch (error) {
    console.error(error);
  }
  console.log(`Done notarizing ${appId}`);
};
