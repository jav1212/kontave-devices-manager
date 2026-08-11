import type { DeviceInfo, DeviceStatus, ManagerEvent } from "../protocol/contracts.js";

export interface DeviceAdapter {
  readonly category: DeviceInfo["category"];
  detect(): Promise<DeviceInfo[]>;
  connect(deviceId?: string): Promise<DeviceInfo>;
  disconnect(): Promise<void>;
  getStatus(): DeviceStatus;
  onEvent(listener: (event: ManagerEvent) => void): () => void;
  onDisconnect(listener: (error?: Error) => void): () => void;
}
