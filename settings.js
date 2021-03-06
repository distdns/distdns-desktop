const log = require("electron-log");
const Store = require("electron-store");
const store = new Store();
const { ipcRenderer, remote } = require("electron");

let preferencesChanged = false;

const toggleSettings = (name, value) => {
  toggle = ipcRenderer.sendSync("toggle-settings", name, value);
  document.getElementById(name).checked = toggle;
  preferencesChanged = true;
};

const closeWindow = () => {
  let window = remote.getCurrentWindow();
  window.close();
};

const renderError = () => {
  document.getElementById("result").classList.toggle("hidden");
  document.getElementById("checkbox").classList.toggle("hidden");
  document.getElementById("saved-failed").classList.toggle("hidden");

  /**
    Change preferencesChanged value after error displayed
    to be enable to close the window
  */
  preferencesChanged = false;
};

const closeBtnFunction = () => {
  // Request new DNS servers only if changed has been made
  // Prevent uneccessary requests to OpenNic API
  if (preferencesChanged) {
    ipcRenderer.send("get-opennic-servers", "");
    ipcRenderer.on("get-opennic-servers-reply", (event, response) => {
      if (!response) {
        log.error(
          "Error while getting new OpenNic DNS servers. Please see log file for more informations"
        );
        renderError();
      } else {
        closeWindow();
      }
    });
  } else {
    closeWindow();
  }
};

const renderSettings = () => {
  // Close btn
  document
    .getElementById("close-btn")
    .addEventListener("click", closeBtnFunction);

  // Preferences
  ["anon", "blacklists"].forEach(item => {
    setting = item + "-setting";
    if (store.get(setting)) {
      document.getElementById(item).checked = true;
    }
  });

  document.getElementById("anon").addEventListener("change", function() {
    toggleSettings(this.id, this.checked);
  });

  document.getElementById("blacklists").addEventListener("change", function() {
    toggleSettings(this.id, this.checked);
  });

  // If no network, hide options
  if (!store.get("network")) {
    renderError();
    document.getElementById("msg-failed").innerHTML =
      "No internet connection !";
    log.warn("Settings window with No internet connection !!!");
  }

  // App Version
  if (store.get("version")) {
    document.getElementById("version").innerHTML = 'v' + store.get('version')
  } else {
    log.debug("App version not found !!")
  }
};

renderSettings();
