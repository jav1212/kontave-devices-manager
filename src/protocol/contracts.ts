export const PROTOCOL_VERSION = 1;

export type DeviceCategory = "barcode-scanner" | "fiscal-printer" | "scale" | "receipt-printer" | "payment-terminal";
export type DeviceStatus = "disconnected" | "detecting" | "connecting" | "connected" | "reconnecting" | "error";

export interface DeviceInfo {
  id: string;
  category: DeviceCategory;
  manufacturer: string;
  model: string;
  connection: string;
}

export type ManagerEvent =
  | { type: "manager.hello"; protocolVersion: number; managerVersion: string; paired: boolean }
  | { type: "device.status"; device: DeviceInfo | null; status: DeviceStatus; message?: string }
  | { type: "barcode.scanned"; eventId: string; device: DeviceInfo; barcode: string; symbology?: string; occurredAt: string }
  | { type: "pairing.result"; approved: boolean; token?: string; message?: string }
  | { type: "manager.error"; code: string; message: string; eventId?: string; occurredAt?: string; managerVersion?: string; installId?: string };

export type ClientMessage =
  | { type: "client.hello"; protocolVersion: number }
  | { type: "pairing.request"; clientName: string; protocolVersion: number };

export function parseClientMessage(value: unknown): ClientMessage | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (item.type === "client.hello" && typeof item.protocolVersion === "number") return item as ClientMessage;
  if (item.type === "pairing.request" && typeof item.clientName === "string" && item.clientName.length > 0 && item.clientName.length <= 100 && typeof item.protocolVersion === "number") return item as ClientMessage;
  return null;
}
