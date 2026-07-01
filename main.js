const { app, BrowserWindow, ipcMain } = require("electron");

const path = require("path");



let mainWindow;



function createWindow() {

  mainWindow = new BrowserWindow({

    width: 1400,

    height: 900,

    backgroundColor: "#000000",

    webPreferences: {

      contextIsolation: true,

      nodeIntegration: false,

      preload: path.join(__dirname, "preload.js")

    }

  });



  mainWindow.loadFile("editor.html");

}



/* OUVERTURE DE TEST.HTML */

function openTestWindow() {

  const testWindow = new BrowserWindow({

    width: 1000,

    height: 700,

    backgroundColor: "#000000",

    webPreferences: {

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