import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface ManagerConfig {
  websocketPort: number; allowedOrigins: string[]; selectedDeviceId?: string;
  serialPort?: string; vendorId?: string; productId?: string; serialNumber?: string;
  baudRate: number; pairingTokenHash?: string; tlsPfxPath?: string; tlsPfxPassphrase?: string; installId: string;
}
export const dataDirectory = join(process.env.LOCALAPPDATA ?? homedir(), "Kontave", "Device Manager");
export const configPath = process.env.KONTAVE_DEVICE_MANAGER_CONFIG ?? join(dataDirectory, "config.json");
export function loadConfig(path = configPath): ManagerConfig {
  let saved: Partial<ManagerConfig> = {};
  if (existsSync(path)) { try { saved = JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, "")) as Partial<ManagerConfig>; } catch { throw new Error(`Configuración inválida: ${path}`); } }
  return { ...saved, websocketPort: saved.websocketPort ?? 47831, allowedOrigins: saved.allowedOrigins ?? ["https://kontave.com", "https://www.kontave.com", "http://localhost:3000"], baudRate: saved.baudRate ?? 9600, installId: saved.installId ?? randomBytes(12).toString("hex") };
}
export function saveConfig(config: ManagerConfig, path = configPath): void {
  mkdirSync(dirname(path), { recursive: true }); const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", mode: 0o600 }); renameSync(temporary, path);
}
