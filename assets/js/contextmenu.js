const { remote } = require("electron");
const { Menu, MenuItem } = remote;
const { ipcRenderer } = require("electron");

// const menu = new Menu();
const template = [
  {
    label: "Settings",
    click() {
      {
        ipcRenderer.send("open-settings-windows", "");
      }
    },
  },
  {
    label: "Reload",
    accelerator: "CmdOrCtrl+R",
    click(item, focusedWindow) {
      if (focusedWindow) focusedWindow.reload();
    },
  },
  {
    label: "Quit",
    click() {
      {
        ipcRenderer.sendSync("close-app", "");
      }
    },
  },
  {
    type: "separator",
  },
  {
    label: "About DistDNS",
    click() {
      require("electron").shell.openExternal("https://www.distdns.io");
    },
  },
];

const menu = Menu.buildFromTemplate(template);
window.addEventListener(
  "contextmenu",
  e => {
    e.preventDefault();
    menu.popup(remote.getCurrentWindow());
  },
  false
);
