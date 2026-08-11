import { app, BrowserWindow, dialog, Menu, nativeImage, shell, Tray } from "electron";
import { autoUpdater } from "electron-updater";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { DeviceManager, type ManagerSnapshot } from "../core/device-manager.js";
import { configPath, loadConfig, saveConfig } from "../core/config.js";
import { Logger } from "../core/logger.js";
import { QW2100Adapter } from "../devices/barcode-scanner/qw2100-adapter.js";
import { DeviceGateway } from "../gateway/device-gateway.js";

let tray: Tray | null = null; let window: BrowserWindow | null = null; let manager: DeviceManager | null = null; let quitting = false;
const logger = new Logger();
const icon = nativeImage.createFromDataURL("data:image/svg+xml;base64," + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="8" fill="#2563eb"/><path d="M8 9h2v14H8zm4 0h1v14h-1zm3 0h3v14h-3zm5 0h1v14h-1zm3 0h2v14h-2z" fill="white"/></svg>').toString("base64"));

function diagnosticsHtml(state: ManagerSnapshot): string {
  const escape = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
  return `<!doctype html><html lang="es"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Kontave Device Manager</title><style>body{font:14px system-ui;margin:0;background:#f5f7fb;color:#162033}.head{background:#2563eb;color:white;padding:24px}main{padding:24px}.card{background:white;border:1px solid #dde3ed;border-radius:12px;padding:18px;margin-bottom:14px}.status{font-weight:700;text-transform:capitalize}.ok{color:#16803c}.bad{color:#b42318}dt{color:#667085;margin-top:12px}dd{margin:3px 0 0;font-weight:600}.foot{color:#667085;font-size:12px}</style><div class="head"><h2>Kontave Device Manager</h2><div>Centro local de dispositivos</div></div><main><div class="card"><div class="status ${state.status === "connected" ? "ok" : "bad"}">${escape(state.status)}</div><dl><dt>Dispositivo</dt><dd>${escape(state.device ? `${state.device.manufacturer} ${state.device.model}` : null)}</dd><dt>Conexión</dt><dd>${escape(state.device?.connection)}</dd><dt>Gateway</dt><dd>${escape(state.gatewayUrl)}</dd><dt>Último error</dt><dd>${escape(state.lastError)}</dd></dl></div><p class="foot">La aplicación continúa funcionando al cerrar esta ventana. Usa el icono de la bandeja para salir.</p></main></html>`;
}
function showWindow(state = manager?.getSnapshot()): void {
  if (!state) return; if (!window) { window = new BrowserWindow({ width: 500, height: 530, resizable: false, icon, webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false } }); window.on("closed", () => { window = null; }); }
  void window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(diagnosticsHtml(state))}`); window.show();
}
function updateTray(state: ManagerSnapshot): void {
  if (!tray) return; tray.setToolTip(`Kontave Device Manager — ${state.status}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: `Estado: ${state.status}`, enabled: false },
    { label: state.device ? `${state.device.model} (${state.device.connection})` : "Sin dispositivo", enabled: false },
    { type: "separator" }, { label: "Abrir diagnóstico", click: () => showWindow() },
    { label: "Abrir registros", click: () => void shell.showItemInFolder(logger.path) }, { label: "Abrir configuración", click: () => void shell.showItemInFolder(configPath) },
    { type: "separator" }, { label: "Buscar actualizaciones", click: () => void autoUpdater.checkForUpdates().catch((error: unknown) => logger.error("Actualización fallida", String(error))) },
    { label: "Salir", click: () => { quitting = true; app.quit(); } },
  ]));
  if (window?.isVisible()) showWindow(state);
}

async function ensureTls(): Promise<void> {
  const current = loadConfig();
  if (current.tlsPfxPath) return;
  const consent = await dialog.showMessageBox({ type: "question", buttons: ["Ahora no", "Configurar"], defaultId: 1, cancelId: 0, title: "Conexión local segura", message: "Kontave necesita autorizar una conexión segura con este equipo.", detail: "Windows solicitará confirmar un certificado local válido únicamente para localhost. No concede acceso desde Internet." });
  if (consent.response !== 1) return;
  const script = app.isPackaged ? join(process.resourcesPath, "assets", "setup-local-tls.ps1") : join(app.getAppPath(), "assets", "setup-local-tls.ps1");
  await new Promise<void>((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-ConfigPath", configPath], { windowsHide: true, stdio: "ignore" });
    child.once("error", reject); child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`PowerShell terminó con código ${code}`)));
  });
}

app.requestSingleInstanceLock() || app.quit();
app.on("second-instance", () => showWindow()); app.on("window-all-closed", () => undefined); app.on("before-quit", (event) => { if (!quitting) { event.preventDefault(); return; } });
await app.whenReady();
app.setLoginItemSettings({ openAtLogin: true, args: ["--hidden"] }); tray = new Tray(icon); tray.on("double-click", () => showWindow());
try { await ensureTls(); } catch (error) { logger.error("No se pudo configurar TLS", String(error)); void dialog.showErrorBox("Conexión segura", "No fue posible configurar el certificado local. Puedes reintentarlo reinstalando o revisar los registros."); }
const config = loadConfig(); saveConfig(config);
const gateway = new DeviceGateway(config, app.getVersion(), async ({ clientName, origin }) => (await dialog.showMessageBox({ type: "question", buttons: ["Rechazar", "Permitir"], defaultId: 1, cancelId: 0, title: "Emparejar con Kontave", message: `${clientName} solicita acceso a los dispositivos`, detail: `Origen: ${origin}\n\nPermite únicamente si tú abriste Kontave en este equipo.` })).response === 1);
manager = new DeviceManager(new QW2100Adapter(config), gateway, logger); manager.onChange(updateTray);
try { await manager.start(); } catch (error) { logger.error("Inicio fallido", String(error)); void dialog.showErrorBox("Kontave Device Manager", "No se pudo iniciar el servicio local. Revisa los registros."); }
if (!process.argv.includes("--hidden")) showWindow();
autoUpdater.autoDownload = false; autoUpdater.on("update-available", async () => { if ((await dialog.showMessageBox({ type: "info", buttons: ["Después", "Descargar"], defaultId: 1, message: "Hay una actualización disponible." })).response === 1) void autoUpdater.downloadUpdate(); }); autoUpdater.on("update-downloaded", () => { quitting = true; autoUpdater.quitAndInstall(); });
if (app.isPackaged) setTimeout(() => void autoUpdater.checkForUpdates().catch((error: unknown) => logger.error("Comprobación de actualizaciones fallida", String(error))), 15_000);
app.on("before-quit", () => { if (quitting) void manager?.stop(); });
