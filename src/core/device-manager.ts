import type { DeviceAdapter } from "../devices/device-adapter.js";
import type { DeviceGateway } from "../gateway/device-gateway.js";
import type { DeviceInfo, DeviceStatus } from "../protocol/contracts.js";
import type { Logger } from "./logger.js";

export interface ManagerSnapshot { status: DeviceStatus; device: DeviceInfo | null; lastError: string | null; gatewayUrl: string | null }
export class DeviceManager {
  private snapshot: ManagerSnapshot = { status: "disconnected", device: null, lastError: null, gatewayUrl: null }; private stopped = true; private retry = 0; private timer?: NodeJS.Timeout; private listeners = new Set<(snapshot: ManagerSnapshot) => void>();
  constructor(private readonly adapter: DeviceAdapter, private readonly gateway: DeviceGateway, private readonly logger: Logger) {
    adapter.onEvent((event) => gateway.broadcast(event)); adapter.onDisconnect((error) => { if (!this.stopped) { this.logger.error("Dispositivo desconectado", error?.message); void this.reconnect(error); } });
  }
  async start(): Promise<void> { this.stopped = false; this.snapshot.gatewayUrl = await this.gateway.start(); this.logger.info("Gateway iniciado", this.snapshot.gatewayUrl); await this.connect(); }
  async stop(): Promise<void> { this.stopped = true; if (this.timer) clearTimeout(this.timer); await this.adapter.disconnect(); await this.gateway.stop(); this.setStatus("disconnected", null); }
  getSnapshot(): ManagerSnapshot { return { ...this.snapshot }; }
  onChange(listener: (snapshot: ManagerSnapshot) => void): () => void { this.listeners.add(listener); listener(this.getSnapshot()); return () => this.listeners.delete(listener); }
  private async connect(): Promise<void> {
    if (this.stopped) return; this.setStatus(this.retry ? "reconnecting" : "detecting", null);
    try { this.setStatus("connecting", null); const device = await this.adapter.connect(); this.retry = 0; this.snapshot.device = device; this.setStatus("connected", null); this.logger.info("Dispositivo conectado", device); }
    catch (error) { const message = error instanceof Error ? error.message : "Error desconocido"; this.logger.error("No se pudo conectar", message); this.setStatus("error", message); this.schedule(); }
  }
  private async reconnect(error?: Error): Promise<void> { await this.adapter.disconnect(); this.snapshot.device = null; this.setStatus("reconnecting", error?.message ?? null); this.schedule(); }
  private schedule(): void { if (this.stopped || this.timer) return; const delays = [1000, 2000, 5000, 10000, 30000]; const delay = delays[Math.min(this.retry++, delays.length - 1)]; this.timer = setTimeout(() => { this.timer = undefined; void this.connect(); }, delay); }
  private setStatus(status: DeviceStatus, lastError: string | null): void { this.snapshot.status = status; this.snapshot.lastError = lastError; this.gateway.broadcast({ type: "device.status", device: this.snapshot.device, status, message: lastError ?? undefined }); this.listeners.forEach((listener) => listener(this.getSnapshot())); }
}
