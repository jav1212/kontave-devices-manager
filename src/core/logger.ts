import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";
import { dataDirectory } from "./config.js";
export class Logger {
  readonly path = join(dataDirectory, "device-manager.log");
  constructor() { mkdirSync(dataDirectory, { recursive: true }); }
  info(message: string, details?: unknown): void { this.write("INFO", message, details); }
  error(message: string, details?: unknown): void { this.write("ERROR", message, details); }
  private write(level: string, message: string, details?: unknown): void {
    if (existsSync(this.path) && statSync(this.path).size > 2_000_000) renameSync(this.path, `${this.path}.1`);
    appendFileSync(this.path, `${JSON.stringify({ at: new Date().toISOString(), level, message, details })}\n`, "utf8");
  }
}
