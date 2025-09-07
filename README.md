# Arinrare's Discord Rich Presence DOSBox Tray App

A Windows-only Electron tray application that displays Discord Rich Presence and DOSBox status.

---

## Features

- System tray icon with context menu (Enable/Disable Start with Windows, Quit)
- Discord Rich Presence integration
- DOSBox process detection
- Logging to `%APPDATA%\dosboxstatus\dosboxstatus.log`
- Auto-start with Windows (optional)

---

## Installation (Windows Only)

1. **Download and install Node.js** (v16 or newer recommended).

2. **Clone or download this repository.**

3. **Install dependencies:**
   ```powershell
   npm install
   ```

4. **Build the app:**
   ```powershell
   npm run build
   ```

5. **Run the packaged installer:**
   - After building, find the installer in the `dist` folder (e.g., `dist\DOSBox Status Setup.exe`).
   - Double-click to install.

6. **After installation:**
   - The app will run in the system tray.
   - Right-click the tray icon for options.
   - Logs are written to `%APPDATA%\dosboxstatus\dosboxstatus.log`.

---

## Important Notes

- **Windows Only:**  
  This app is designed for Windows and will not work on macOS or Linux.

- **App Name & App ID:**  
  **Do not change the `appId` or `productName` in `package.json` after installation.**  
  Changing these can result in duplicate registry entries and leftover auto-start entries.  
  If you must change them, uninstall the previous version first and clean up registry keys in:
  ```
  HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run
  ```

- **ASAR Packaging:**  
  The app uses `"asar": false"` in `package.json` to support native binaries required by `ps-list`.  
  This is less secure but necessary for reliable process detection.

- **Dependencies:**  
  - `ps-list` for process detection (make sure it is listed under `"dependencies"`).
  - Electron for tray and window management.

- **Logging:**  
  All logs are written to `%APPDATA%\dosboxstatus\dosboxstatus.log`.  
  The app will create the folder if it does not exist.

- **Tray Icon:**  
  Replace `assets/icon.png` with your own icon for best results.

---

## Project Structure

- `main.js` — Electron main process (tray, menu, auto-start logic)
- `trayPreload.js` — Preload script for tray window IPC
- `src/utils/detectDosbox.js` — DOSBox detection logic (uses `ps-list` and PowerShell)
- `assets/icon.png` — Tray icon
- `app/trayWindow.html` — Tray window HTML
- `package.json` — Project metadata, build config, and scripts
- `README.md` — This documentation

---

## Requirements

- Windows OS
- Node.js v16 or newer

---

## Troubleshooting

- If the app does not detect DOSBox, ensure `ps-list` is installed and the binary is present in `node_modules/ps-list/vendor/`.
- If you see duplicate tray icons or registry entries, uninstall previous versions and clean up registry keys.
- For process detection issues, check the log file at `%APPDATA%\dosboxstatus\dosboxstatus.log`.

---

Feel free to customize the menu, tray icon, and add more features!