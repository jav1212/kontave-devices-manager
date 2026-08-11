import { randomUUID } from "node:crypto";
import { SerialPort } from "serialport";
import type { ManagerConfig } from "../../core/config.js";
import type { DeviceInfo, DeviceStatus, ManagerEvent } from "../../protocol/contracts.js";
import type { DeviceAdapter } from "../device-adapter.js";
import { BarcodeParser } from "./barcode-parser.js";
const normalize = (value?: string) => value?.toLowerCase().replace(/^0x/, "");
type PortInfo = Awaited<ReturnType<typeof SerialPort.list>>[number];
export class QW2100Adapter implements DeviceAdapter {
  readonly category = "barcode-scanner" as const; private port: SerialPort | null = null; private status: DeviceStatus = "disconnected"; private info: DeviceInfo | null = null;
  private listeners = new Set<(event: ManagerEvent) => void>(); private disconnectListeners = new Set<(error?: Error) => void>();
  private parser = new BarcodeParser((barcode) => { if (this.info) this.listeners.forEach((listener) => listener({ type: "barcode.scanned", eventId: randomUUID(), device: this.info!, barcode, occurredAt: new Date().toISOString() })); });
  constructor(private readonly config: ManagerConfig) {}
  async detect(): Promise<DeviceInfo[]> { return (await SerialPort.list()).filter((port) => this.matches(port)).map((port) => this.toInfo(port)); }
  async connect(deviceId?: string): Promise<DeviceInfo> {
    this.status = "connecting"; const ports = await SerialPort.list(); const selected = ports.find((item) => deviceId ? this.toInfo(item).id === deviceId : this.matches(item));
    if (!selected) { this.status = "error"; throw new Error("No se encontró un lector compatible. Configura el QW2100 en USB-COM-STD."); }
    const info = this.toInfo(selected);
    await new Promise<void>((resolve, reject) => { const port = new SerialPort({ path: selected.path, baudRate: this.config.baudRate, dataBits: 8, stopBits: 1, parity: "none", autoOpen: false }); this.port = port; port.on("data", (chunk: Buffer) => this.parser.push(chunk)); port.on("error", (error) => this.disconnectListeners.forEach((listener) => listener(error))); port.on("close", () => this.disconnectListeners.forEach((listener) => listener())); port.open((error) => error ? reject(error) : resolve()); });
    this.info = info; this.status = "connected"; return info;
  }
  async disconnect(): Promise<void> { const current = this.port; this.port = null; this.info = null; this.status = "disconnected"; this.parser.reset(); if (current?.isOpen) await new Promise<void>((resolve) => current.close(() => resolve())); }
  getStatus(): DeviceStatus { return this.status; }
  onEvent(listener: (event: ManagerEvent) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  onDisconnect(listener: (error?: Error) => void): () => void { this.disconnectListeners.add(listener); return () => this.disconnectListeners.delete(listener); }
  private matches(port: PortInfo): boolean { if (this.config.serialPort) return port.path === this.config.serialPort; if (this.config.serialNumber) return port.serialNumber === this.config.serialNumber; if (this.config.vendorId || this.config.productId) return (!this.config.vendorId || normalize(port.vendorId) === normalize(this.config.vendorId)) && (!this.config.productId || normalize(port.productId) === normalize(this.config.productId)); return normalize(port.vendorId) === "05f9"; }
  private toInfo(port: PortInfo): DeviceInfo { return { id: `qw2100:${port.serialNumber ?? `${port.vendorId ?? "usb"}:${port.productId ?? "serial"}:${port.path}`}`, category: this.category, manufacturer: port.manufacturer ?? "Datalogic", model: "QuickScan QW2100", connection: port.path }; }
}
