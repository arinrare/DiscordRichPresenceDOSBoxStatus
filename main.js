process.env.ASAR_DISABLE = 'true';
const { app, Tray, BrowserWindow, Notification } = require('electron');
const { isDosboxRunning, getDosboxWindowTitleViaPowerShell, extractDosboxInfo } = require('./src/utils/detectDosbox');
const DiscordRPC = require('discord-rpc');
const { ipcMain, Menu } = require('electron');
const logging = false;
let rpc;
let rpcReady = false;
let tray = null;
let trayWindow = null;
const path = require('path');
const fs = require('fs');
const os = require('os');

// Config file path in app data folder
const appDataPath = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const configDir = path.join(appDataPath, 'dosboxstatus');
const configPath = path.join(configDir, 'config.json');

// Ensure config directory exists
function ensureConfigDir() {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

// Save user preference
function saveConfig(openAtLogin) {
  try {
    ensureConfigDir();
    fs.writeFileSync(configPath, JSON.stringify({ openAtLogin }, null, 2));
  } catch (err) {
    if (logging) console.error('Failed to save config:', err);
  }
}

// Load user preference
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.openAtLogin;
    }
  } catch (err) {
    if (logging) console.error('Failed to load config:', err);
  }
  return null; // Return null if no config or error
}

const clientId = '1414117031246037013';

app.on('ready', () => {
  // Clean up any stale login items that might point to old/moved executables
  if (app.isPackaged) {
    const currentSettings = app.getLoginItemSettings();
    if (currentSettings.openAtLogin && currentSettings.executableWillLaunchAtLogin === false) {
      // The registry entry exists but the executable path is invalid
      app.setLoginItemSettings({ openAtLogin: false });
    }
  }

  tray = new Tray(__dirname + '/assets/icon.png');
  tray.setToolTip('Dosbox Status');
  
  // Load preference from config file, fallback to system setting
  let savedPreference = loadConfig();
  let openAtLogin = savedPreference !== null ? savedPreference : app.getLoginItemSettings().openAtLogin;
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: openAtLogin ? 'Disable Start with Windows' : 'Enable Start with Windows',
      click: () => {
        openAtLogin = !openAtLogin;
        saveConfig(openAtLogin);
        app.setLoginItemSettings({ 
          openAtLogin,
          path: process.execPath,
          args: openAtLogin ? ['--hidden'] : []
        });
        tray.setContextMenu(Menu.buildFromTemplate([
          {
            label: openAtLogin ? 'Disable Start with Windows' : 'Enable Start with Windows',
            click: () => {
              openAtLogin = !openAtLogin;
              saveConfig(openAtLogin);
              app.setLoginItemSettings({ 
                openAtLogin,
                path: process.execPath,
                args: openAtLogin ? ['--hidden'] : []
              });
              tray.setContextMenu(contextMenu);
            }
          },
          { type: 'separator' },
          {
            label: 'Quit',
            click: () => {
              app.quit();
            }
          }
        ]));
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  // Save the initial preference if it's the first run (no config file exists)
  if (savedPreference === null) {
    saveConfig(openAtLogin);
  }

  if (app.isPackaged && openAtLogin) {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: process.execPath,
      args: ['--hidden']
    });
  }

  trayWindow = new BrowserWindow({
    width: 160,
    height: 80,
    show: false,
    frame: false,
    resizable: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: __dirname + '/trayPreload.js'
    }
  });

  
  trayWindow.loadFile(__dirname + '/app/trayWindow.html');

  tray.on('click', (event, bounds) => {
    if (!trayWindow.isVisible()) {
      const { x, y } = tray.getBounds();
      trayWindow.setPosition(x, y - 80);
      trayWindow.show();
    } else {
      trayWindow.hide();
    }
  });

  let lastDosboxState = null;

  if (process.platform === 'darwin') {
    app.dock.hide();
  }

  connectDiscordRPC();

  setInterval(async () => {
  try {
    const running = await isDosboxRunning();
    if (running && rpcReady) {
      getDosboxWindowTitleViaPowerShell(title => {
        const info = extractDosboxInfo(title);
        if (logging) console.log('Extracted info:', info);
        if (info) {
          rpc.setActivity({
            details: info.dosbox || 'DOSBox',
            state: info.program ? `Playing: ${info.program}` : undefined,
            largeImageKey: 'icon',
            largeImageText: info.dosbox || 'DOSBox',
            instance: false
          });
        }
      });
    } else if (rpcReady) {
      rpc.clearActivity().catch(() => {});
    }
      if (logging) console.log('Dosbox:', running);
      if (running && lastDosboxState !== true) {
        new Notification({
          title: 'Dosbox Detected',
          body: 'Dosbox is running!'
        }).show();
      }
      if (lastDosboxState !== running) {
        trayWindow.webContents.send('dosbox-status', running);
        lastDosboxState = running;
      }
    } catch (err) {
      if (logging) console.error('Error checking Dosbox:', err);
    }
  }, 5000);
});

app.on('before-quit', () => {
  // Clean up login item based on user preference or if config is missing
  if (app.isPackaged) {
    const savedPreference = loadConfig();
    if (savedPreference === null || savedPreference === false) {
      // Either no config file (uninstalled) or user disabled auto-start
      app.setLoginItemSettings({ openAtLogin: false });
    }
  }
});

ipcMain.on('hide-tray-window', () => {
  if (trayWindow && trayWindow.isVisible()) {
    trayWindow.hide();
  }
});

function connectDiscordRPC() {

  rpc = new DiscordRPC.Client({ transport: 'ipc' });

  DiscordRPC.register(clientId);
  
  rpc.on('ready', () => {
    rpcReady = true;
    if (logging) console.log('Discord RPC ready');
  });

  rpc.on('disconnected', () => {
    rpcReady = false;
    if (logging) console.log('Discord RPC disconnected, retrying in 5s...');
    setTimeout(connectDiscordRPC, 5000);
  });

  rpc.login({ clientId }).catch(err => {
    rpcReady = false;
    if (logging) console.error('Discord RPC login error:', err);
    setTimeout(connectDiscordRPC, 5000);
  });
}
