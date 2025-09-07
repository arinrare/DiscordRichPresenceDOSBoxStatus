const psList = require('ps-list').default;
const fs = require('fs');
const path = require('path');

const logDir = path.join(process.env.APPDATA, 'dosboxstatus');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logPath = path.join(logDir, 'dosboxstatus.log');

function logToFile(message) {
  fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
}

async function isDosboxRunning() {
  try {
    const processes = await psList();
    // Only match exact process names (dosbox.exe, dosbox-x.exe, etc.)
    const dosboxProcess = processes.find(p => {
      const name = p.name && p.name.toLowerCase();
      return name === 'dosbox.exe' || name === 'dosbox-x.exe' || name === 'dosboxece.exe';
    });
    if (!dosboxProcess) return false;

    // Check for a valid Dosbox window title
    return await new Promise(resolve => {
      getDosboxWindowTitleViaPowerShell(title => {
        resolve(!!title);
      });
    });
  } catch (err) {
    logToFile('ps-list failed: ' + err);
    return false;
  }
}

const { windowManager } = require('node-window-manager');
const { exec } = require('child_process');

function getDosboxWindowTitleViaPowerShell(callback) {
  const psCmd = `powershell -Command "Get-Process | Where-Object { $_.ProcessName -match '^dosbox' -and $_.MainWindowTitle -like '*DosBOX*' } | Select-Object -ExpandProperty MainWindowTitle"`;
  exec(psCmd, (error, stdout, stderr) => {
    if (error) {
      logToFile('PowerShell error: ' + error);
      callback(null);
      return;
    }
    const title = stdout.trim();
    callback(title || null);
  });
}

function extractDosboxInfo(title) {
  if (!title) return null;
  // Example: DOSBox ECE r4230, CPU speed: max 100% cycles, Frameskip  0, Program: SHANNARA
  const dosboxMatch = title.match(/DOSBox[^,]*/i);
  const programMatch = title.match(/Program:\s*([^,]*)/i);
  return {
    dosbox: dosboxMatch ? dosboxMatch[0].trim() : null,
    program: programMatch ? programMatch[1].trim() : null
  };
}

module.exports = { isDosboxRunning, getDosboxWindowTitleViaPowerShell, extractDosboxInfo };
