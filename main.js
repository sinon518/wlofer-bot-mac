const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { app, BrowserWindow, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("fs");

// Basic Auto-Updater configuration
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow;
let splashWindow;
let expressServerInstance;
let autoUploaderService;

const USER_DATA_DIR = path.join(app.getPath("documents"), "Wlofer_Data");
if (!fs.existsSync(USER_DATA_DIR))
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });
process.env.WLOFER_DATA_PATH = USER_DATA_DIR;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 400,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  splashWindow.loadFile(path.join(__dirname, "public/splash.html"));
}

async function startServer() {
  return new Promise((resolve) => {
    const expressApp = require("./src/app");
    autoUploaderService = require("./src/services/autoUploaderService");
    autoUploaderService.start();

    expressServerInstance = expressApp.listen(0, () => {
      const dynamicPort = expressServerInstance.address().port;
      resolve(`http://localhost:${dynamicPort}`);
    });
  });
}

function sendToSplash(status, progress) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send("update-status", { status, progress });
  }
}

async function initializeApp() {
  createSplashWindow();

  // 1. Initial State
  sendToSplash("Sistem Başlatılıyor...", 10);

  // 2. Start Server in background
  const serverUrl = await startServer();
  sendToSplash("Sunucu Bağlantısı Kuruldu.", 40);

  // 3. Setup Updater Listeners
  autoUpdater.on("update-available", () => {
    sendToSplash("Yeni Güncelleme Bulundu!", 50);
  });

  autoUpdater.on("download-progress", (progressObj) => {
    sendToSplash(
      `Güncelleme İndiriliyor: %${Math.floor(progressObj.percent)}`,
      50 + progressObj.percent / 2,
    );
  });

  autoUpdater.on("update-downloaded", () => {
    sendToSplash("Güncelleme Hazır. Yeniden Başlatılıyor...", 100);
    setTimeout(() => {
      autoUpdater.quitAndInstall();
    }, 2000);
  });

  autoUpdater.on("update-not-available", () => {
    launchMain(serverUrl);
  });

  autoUpdater.on("error", (err) => {
    console.error("Update Error:", err);
    launchMain(serverUrl);
  });

  // 4. Check for Updates
  autoUpdater.checkForUpdatesAndNotify().catch(() => launchMain(serverUrl));
}

function launchMain(serverUrl) {
  if (mainWindow) return;

  mainWindow = new BrowserWindow({
    width: 1300,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(serverUrl);

  mainWindow.once("ready-to-show", () => {
    if (splashWindow) {
      splashWindow.webContents.send("ready-to-launch");
      setTimeout(() => {
        if (splashWindow) splashWindow.close();
        mainWindow.show();
      }, 1000);
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(initializeApp);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    if (expressServerInstance) expressServerInstance.close();
    // stop any other services if needed
    app.quit();
  }
});
