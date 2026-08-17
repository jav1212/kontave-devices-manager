import { randomUUID } from "node:crypto";
import { SerialPort } from "serialport";
import type { ManagerConfig } from "../../core/config.js";
import type { DeviceInfo, DeviceStatus, ManagerEvent } from "../../protocol/contracts.js";
import type { DeviceAdapter } from "../device-adapter.js";
import { BarcodeParser } from "./barcode-parser.js";
import { WindowsDatalogicHidDetector, type DatalogicHidDetector, type DatalogicHidDevice } from "./windows-hid-detector.js";
const normalize = (value?: string) => value?.toLowerCase().replace(/^0x/, "");
type PortInfo = Awaited<ReturnType<typeof SerialPort.list>>[number];
export class QW2100Adapter implements DeviceAdapter {
  readonly category = "barcode-scanner" as const; private port: SerialPort | null = null; private status: DeviceStatus = "disconnected"; private info: DeviceInfo | null = null;
  private hidMonitor?: NodeJS.Timeout;
  private listeners = new Set<(event: ManagerEvent) => void>(); private disconnectListeners = new Set<(error?: Error) => void>();
  private parser = new BarcodeParser((barcode) => { if (this.info) this.listeners.forEach((listener) => listener({ type: "barcode.scanned", eventId: randomUUID(), device: this.info!, barcode, occurredAt: new Date().toISOString() })); });
  constructor(private readonly config: ManagerConfig, private readonly hidDetector: DatalogicHidDetector = new WindowsDatalogicHidDetector()) {}
  async detect(): Promise<DeviceInfo[]> {
    const serialDevices = (await SerialPort.list()).filter((port) => this.matches(port)).map((port) => this.toInfo(port));
    const hidDevice = await this.detectHidSafely();
    return hidDevice ? [...serialDevices, this.toHidInfo(hidDevice)] : serialDevices;
  }
  async connect(deviceId?: string): Promise<DeviceInfo> {
    this.status = "connecting"; const ports = await SerialPort.list(); const selected = ports.find((item) => deviceId ? this.toInfo(item).id === deviceId : this.matches(item));
    if (!selected) {
      const hidDevice = await this.detectHidSafely();
      if (hidDevice) {
        const info = this.toHidInfo(hidDevice);
        this.info = info; this.status = "connected"; this.startHidMonitor(); return info;
      }
      this.status = "error"; throw new Error("No se encontró un lector compatible. Conecta el QW2100 en USB-KBD/HID o USB-COM-STD.");
    }
    this.stopHidMonitor();
    const info = this.toInfo(selected);
    await new Promise<void>((resolve, reject) => { const port = new SerialPort({ path: selected.path, baudRate: this.config.baudRate, dataBits: 8, stopBits: 1, parity: "none", autoOpen: false }); this.port = port; port.on("data", (chunk: Buffer) => this.parser.push(chunk)); port.on("error", (error) => this.disconnectListeners.forEach((listener) => listener(error))); port.on("close", () => this.disconnectListeners.forEach((listener) => listener())); port.open((error) => error ? reject(error) : resolve()); });
    this.info = info; this.status = "connected"; return info;
  }
  async disconnect(): Promise<void> { const current = this.port; this.stopHidMonitor(); this.port = null; this.info = null; this.status = "disconnected"; this.parser.reset(); if (current?.isOpen) await new Promise<void>((resolve) => current.close(() => resolve())); }
  getStatus(): DeviceStatus { return this.status; }
  onEvent(listener: (event: ManagerEvent) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  onDisconnect(listener: (error?: Error) => void): () => void { this.disconnectListeners.add(listener); return () => this.disconnectListeners.delete(listener); }
  private matches(port: PortInfo): boolean { if (this.config.serialPort) return port.path === this.config.serialPort; if (this.config.serialNumber) return port.serialNumber === this.config.serialNumber; if (this.config.vendorId || this.config.productId) return (!this.config.vendorId || normalize(port.vendorId) === normalize(this.config.vendorId)) && (!this.config.productId || normalize(port.productId) === normalize(this.config.productId)); return normalize(port.vendorId) === "05f9"; }
  private toInfo(port: PortInfo): DeviceInfo { return { id: `qw2100:${port.serialNumber ?? `${port.vendorId ?? "usb"}:${port.productId ?? "serial"}:${port.path}`}`, category: this.category, manufacturer: port.manufacturer ?? "Datalogic", model: "QuickScan QW2100", connection: port.path }; }
  private toHidInfo(device: DatalogicHidDevice): DeviceInfo { return { id: `qw2100-hid:${device.instanceId}`, category: this.category, manufacturer: "Datalogic", model: "QuickScan QW2100", connection: "USB-KBD/HID" }; }
  private async detectHidSafely(): Promise<DatalogicHidDevice | null> { try { return await this.hidDetector.detect(); } catch { return null; } }
  private startHidMonitor(): void {
    this.stopHidMonitor(); let checking = false;
    this.hidMonitor = setInterval(() => {
      if (checking) return; checking = true;
      void this.hidDetector.detect().then((device) => {
        if (device || this.info?.connection !== "USB-KBD/HID") return;
        this.stopHidMonitor(); this.status = "disconnected";
        this.disconnectListeners.forEach((listener) => listener(new Error("El lector USB-KBD/HID fue desconectado.")));
      }).catch(() => undefined).finally(() => { checking = false; });
    }, 5_000);
  }
  private stopHidMonitor(): void { if (this.hidMonitor) clearInterval(this.hidMonitor); this.hidMonitor = undefined; }
}
