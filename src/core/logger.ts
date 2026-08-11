import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";
import { dataDirectory } from "./config.js";
export class Logger {
  readonly path = join(dataDirectory, "device-manager.log");
  private errorListeners = new Set<(entry: { message: string; detail?: string; occurredAt: string }) => void>();
  constructor() { mkdirSync(dataDirectory, { recursive: true }); }
  info(message: string, details?: unknown): void { this.write("INFO", message, details); }
  error(message: string, details?: unknown): void {
    const occurredAt = new Date().toISOString();
    this.write("ERROR", message, details, occurredAt);
    const detail = typeof details === "string" ? details.slice(0, 1_000) : undefined;
    this.errorListeners.forEach((listener) => listener({ message, detail, occurredAt }));
  }
  onError(listener: (entry: { message: string; detail?: string; occurredAt: string }) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }
  private write(level: string, message: string, details?: unknown, occurredAt = new Date().toISOString()): void {
    if (existsSync(this.path) && statSync(this.path).size > 2_000_000) renameSync(this.path, `${this.path}.1`);
    appendFileSync(this.path, `${JSON.stringify({ at: occurredAt, level, message, details })}\n`, "utf8");
  }
}
