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

const clientId = '1414117031246037013';

app.on('ready', () => {
  tray = new Tray(__dirname + '/assets/icon.png');
  tray.setToolTip('Dosbox Status');
  let openAtLogin = app.getLoginItemSettings().openAtLogin;
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: openAtLogin ? 'Disable Start with Windows' : 'Enable Start with Windows',
      click: () => {
        openAtLogin = !openAtLogin;
        app.setLoginItemSettings({ openAtLogin });
        tray.setContextMenu(Menu.buildFromTemplate([
          {
            label: openAtLogin ? 'Disable Start with Windows' : 'Enable Start with Windows',
            click: () => {
              openAtLogin = !openAtLogin;
              app.setLoginItemSettings({ 
                openAtLogin
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

  app.setLoginItemSettings({
    openAtLogin: true,
    path: process.execPath,
    args: ['--hidden']
  });

  tray.setContextMenu(contextMenu);

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
