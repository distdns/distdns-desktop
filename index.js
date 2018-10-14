const Store = require("electron-store");
const store = new Store();
const { ipcRenderer, remote } = require("electron");
require("./assets/js/contextmenu");

const getCurrentConfig = () => {
  let status = ipcRenderer.sendSync("get-current-config", "");
  let current_dns = status["dns"].toString().replace(/,/g, " ");
  let statusdns = document.getElementById("statusdns");
  statusdns.innerHTML = "Current DNS Servers: " + current_dns;

  if (status["enable"]) {
    document.getElementById("enable").classList.toggle("hidden");
    statusdns.style.color = "#61b09f";

    document.getElementById("disabledns").addEventListener("click", function() {
      toggleEnable("disable");
    });
  } else {
    document.getElementById("disable").classList.toggle("hidden");
    statusdns.style.color = "#d65a4a";

    document.getElementById("enabledns").addEventListener("click", function() {
      toggleEnable("enable");
    });
  }
};

const render = () => {
  if (!store.has("distdns_servers")) {
    ipcRenderer.send("get-distdns-servers", "");
    ipcRenderer.on("get-distdns-servers-reply", (event, response) => {
      if (response) {
        document.getElementById("loading").classList.add("hide");
        getCurrentConfig();
      } else {
        document.getElementById("disable").classList.toggle("hidden");
        document.getElementById("statusmsg").innerHTML =
          "Could not retrieve DistDNS DNS servers !\nBe sure to be connected to internet or restart the application";
      }
    });
  } else {
    document.getElementById("loading").classList.add("hide");
    
    getCurrentConfig()
  }
};

const toggleEnable = state => {
  ipcRenderer.send("enable-disable", state);
  ipcRenderer.on("enable-disable-reply", (event, response) => {
    remote.getCurrentWindow().reload();
  });
};

render();
