const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: "#000000",
    autoHideMenuBar: true, // Masque le menu par défaut (accessible en appuyant sur Alt)
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
    }
  });

  // Pour supprimer complètement la barre de menu sans possibilité d'accès via Alt :
  // mainWindow.setMenu(null);

  mainWindow.loadFile("editor.html");
}

/* OUVERTURE DE TEST.HTML */
function openTestWindow() {
  const testWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    backgroundColor: "#000000",
    autoHideMenuBar: true, // Masque également la barre de menu sur la deuxième fenêtre
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  testWindow.loadFile("index.html");
}

/* IPC depuis renderer */
ipcMain.on("open-test", () => {
  openTestWindow();
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});