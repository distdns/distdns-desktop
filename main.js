const {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  nativeImage,
  net,
  Menu,
} = require("electron");
const path = require("path");
const electron = require("electron");
const Store = require("electron-store");
const log = require("electron-log");
log.transports.console.level = "debug";

const store = new Store();
const assetsDir = path.join(__dirname, "assets");

const osCmd = require("./lib/" + process.platform);

let tray;
let onlineStatus;

const imageFolder = __dirname + "/assets/images";

const createMainWindow = status => {
  mainWindow = new BrowserWindow({
    width: 570,
    height: 350,
    vibracy: "titlebar",
    darkTheme: true,
    autoHideMenuBar: true,
    resizable: false,
    fullscreenable: false,
    movable: true,
  });

  if (status == "up") {
    mainWindow.loadURL(`file://${path.join(__dirname, "index.html")}`);
  } else {
    mainWindow.loadURL(`file://${path.join(__dirname, "error.html")}`);
  }

  mainWindow.on("close", event => {
    mainWindow = null;
  });
};

const createBackgroundWindow = () => {
  const backgroundWindow = new BrowserWindow({
    show: false,
  });

  backgroundWindow.loadURL(`file://${path.join(__dirname, "background.html")}`);
};

const createSettingsWindow = () => {
  const settingsWindows = new BrowserWindow({
    parent: mainWindow,
    modal: true,
    show: true,
    width: 570,
    height: 350,
    titleBarStyle: "hiddenInset",
    vibracy: "titlebar",
    darkTheme: true,
    autoHideMenuBar: false,
    resizable: false,
    fullscreenable: false,
  });
  settingsWindows.loadURL(`file://${path.join(__dirname, "settings.html")}`);
};

app.on("ready", () => {
  // Default OpenNic API URL
  if (!store.has("apiUrl")) {
    store.set("apiUrl", "https://api.opennic.org/geoip/?json&res=2");
  }

  // Internet active connection ?
  osCmd
    .ping("opennic.org")
    .then(res => {
      if (res == "success") {
        onlineStatus = "up";
        createMainWindow(onlineStatus);
        createBackgroundWindow();
      } else {
        createMainWindow(onlineStatus);
      }
    })
    .catch(err => {
      log.error(err);
    });

  // Tray
  if (process.platform == "darwin") {
    trayImage = imageFolder + "/osx/iconTemplate.png";
  } else if (process.platform == "win32") {
    trayImage = imageFolder + "/win/icon.ico";
  } else {
    trayImage = imageFolder + "/icon.png";
  }
  tray = new Tray(trayImage);

  if (process.platform == "darwin") {
    tray.setPressedImage(imageFolder + "/osx/iconHighlight.png");
  }
  tray.setToolTip("OpenNic DNS !");
  tray.setContextMenu(trayContextMenu);

  // Backup default configuration
  if (!store.has("default_config")) {
    getDefaultConfig();
  }
  if (store.get("was-enabled")) {
    osCmd
      .setDns("enable")
      .then(result => {
        log.debug(
          "App was closed with DNS enabled. Re-enable dns: ",
          result.trim()
        );
        mainWindow.reload();
      })
      .catch(err => {
        log.error(err);
      });
  }
});
// END APP.ON ready

// Build tray menu
const trayMenuTemplate = [
  {
    label: "Show",
    click: function() {
      toggleWindow();
    },
  },
  // TODO
  {
    label: "Settings",
    click: function() {
      createSettingsWindow();
    },
  },
  {
    label: "Help",
    click: function() {
      console.log("Clicked on Help");
    },
  },
  {
    type: "separator",
  },
  {
    label: "Quit OpenNic",
    click: function() {
      closeApp();
    },
  },
];
let trayContextMenu = Menu.buildFromTemplate(trayMenuTemplate);
// END Build tray menu

// Save DNS default user config
const getDefaultConfig = () => {
  osCmd.getCurrentDns().then(data => {
    store.set("default_config", data);
  });
};

// OpenNic DNS servers
const getOpennicServers = () => {
  return new Promise((resolve, reject) => {
    const apiUrl = store.get("apiUrl");
    const request = net.request(apiUrl);
    request.on("response", response => {
      response.on("data", chunk => {
        try {
          const servers = JSON.parse(chunk.toString("utf8"));
          let serversSettings = [];
          for (let s in servers) {
            let setting = {
              ip: servers[s]["ip"],
              loc: servers[s]["loc"],
              stat: servers[s]["stat"],
            };
            serversSettings.push(setting);
          }
          store.set("opennic_servers", serversSettings);
          resolve(true);
        } catch (err) {
          log.error("Get OpenNic DNS servers response error: ", err);
          reject(false);
        }
      });
      response.on("error", err => {
        log.error("Get OpenNic DNS servers response error: ", err);
        reject(false);
      });
      response.on("end", () => {
        log.info("OpenNic DNS Servers saved !");
      });
    });

    request.on("error", err => {
      log.error("Get OpenNic DNS servers response request: ", err);
    });
    request.end();
  });
};

const buildApiUrl = () => {
  // Set default url
  if (!store.get("default-api-url")) {
    store.set("default-api-url", "https://api.opennic.org/geoip/?json&res=2");
  }

  let url = store.get("default-api-url");
  let oldUrl = store.get("apiUrl");
  try {
    if (store.get("anon-setting")) {
      url = url + "&anon=true";
    }
    if (store.get("blacklists-setting")) {
      url = url + "&bl";
    }
  } catch (err) {
    log.error(`buildApiUrl error: ${err}`);
  } finally {
    store.set("apiUrl", url);
  }
};

const matchDnsConfig = () => {
  return new Promise((resolve, reject) => {
    dns = store.get("opennic_servers");
    opennic_array = [dns[0].ip, dns[1].ip];

    osCmd
      .getCurrentDns()
      .then(data => {
        if (
          opennic_array.length == data.dns.length &&
          !opennic_array.some(v => data.dns.indexOf(v) < 0)
        ) {
          resolve([true, data]);
        } else {
          resolve([false, data]);
        }
      })
      .catch(err => {
        reject(err);
      });
  });
};

const checkDnsConfig = () => {
  return new Promise((resolve, reject) => {
    dns = store.get("opennic_servers");
    opennic_array = [dns[0].ip, dns[1].ip];

    matchDnsConfig()
      .then(match => {
        if (match[0]) {
          let status = { enable: true, dns: match[1].dns };
          store.set("enable", true);
          resolve(status);
        } else {
          let status = { enable: false, dns: match[1].dns };
          store.set("enable", false);
          resolve(status);
        }
      })
      .catch(err => {
        reject(err);
      });
  });
};

// windows
const toggleWindow = () => {
  if (mainWindow == null) {
    createMainWindow(onlineStatus);
    showWindow();
  } else if (mainWindow.isMinimized()) {
    mainWindow.restore();
  } else {
    showWindow();
  }
};

const showWindow = () => {
  // calculated position can be found here:
  // https://github.com/jenslind/electron-positioner/blob/master/src/Positioner.js

  const trayPos = tray.getBounds();
  const windowPos = mainWindow.getBounds();
  // Get current display
  points = electron.screen.getCursorScreenPoint();
  const currentDisplay = electron.screen.getDisplayNearestPoint(points);

  let x,
    y = 0;
  if (process.platform == "darwin") {
    x = Math.round(trayPos.x + trayPos.width / 2 - windowPos.width / 2);
    animate = "True";
  } else {
    x = currentDisplay.workArea.x;
    animate = "False";
  }

  mainWindow.setPosition(x, currentDisplay.workArea.y, animate);
  mainWindow.show();
  mainWindow.focus();
};

// If app is closed, put back default configuration.
// We do not want to mess with user configuration
const closeApp = () => {
  if (store.get("enable")) {
    store.set("was-enabled", true);
    osCmd.setDns("disable").then(result => {
      log.info("App has been closed !\nDNS has been disable: ", result.trim());
      app.quit();
    });
  } else {
    store.set("was-enabled", false);
    app.quit();
  }
};

app.on("window-all-closed", () => {
  // Leave open in background on all plateform
  mainWindow == null;
});
// END windows

// ipcRenderer
ipcMain.on("show-window", () => {
  showWindow();
});

ipcMain.on("get-current-config", (event, arg) => {
  checkDnsConfig().then(status => {
    event.returnValue = status;
  });
});

ipcMain.on("open-settings-windows", (event, arg) => {
  createSettingsWindow();
});

ipcMain.on("enable-disable", (event, arg) => {
  osCmd
    .setDns(arg)
    .then(result => {
      log.debug("Disable-enable " + arg + ": " + result.trim());
      if (result === "success") {
        event.sender.send("enable-disable-reply", "success");
      } else {
        event.sender.send("enable-disable-reply", "failed");
      }
    })
    .catch(err => {
      log.error(err);
    });
});

ipcMain.on("get-opennic-servers", (event, arg) => {
  getOpennicServers()
    .then(res => {
      event.sender.send("get-opennic-servers-reply", res);
      if (store.get("enable")) {
        matchDnsConfig().then(match => {
          if (!match[0]) {
            osCmd.setDns("enable").then(result => {
              log.info(
                "DNS servers updated after preferences changed: ",
                result
              );
            });
          }
        });
      }
    })
    .catch(error => {
      log.error("Error while getting new DNS servers");
    });
});

ipcMain.on("toggle-settings", (event, name, value) => {
  s = name + "-setting";
  store.set(s, value);
  buildApiUrl();
  event.returnValue = value;
});

ipcMain.on("close-app", (event, arg) => {
  closeApp();
});
