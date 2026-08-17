import assert from "node:assert/strict";
import test from "node:test";
import { SerialPort } from "serialport";
import type { ManagerConfig } from "../src/core/config.js";
import { QW2100Adapter } from "../src/devices/barcode-scanner/qw2100-adapter.js";
import type { DatalogicHidDetector } from "../src/devices/barcode-scanner/windows-hid-detector.js";

const config: ManagerConfig = { websocketPort: 47831, allowedOrigins: [], baudRate: 9600, installId: "test" };

test("reporta conectado un QW2100 en modo USB-KBD/HID cuando no existe puerto COM", async (context) => {
  const originalList = SerialPort.list;
  SerialPort.list = async () => [];
  context.after(() => { SerialPort.list = originalList; });
  const detector: DatalogicHidDetector = { detect: async () => ({ instanceId: "HID\\VID_05F9&PID_221C\\SCANNER", productId: "221c" }) };
  const adapter = new QW2100Adapter(config, detector);

  const device = await adapter.connect();

  assert.equal(adapter.getStatus(), "connected");
  assert.equal(device.manufacturer, "Datalogic");
  assert.equal(device.connection, "USB-KBD/HID");
  await adapter.disconnect();
});

test("mantiene un diagnóstico compatible con ambos modos cuando no encuentra el lector", async (context) => {
  const originalList = SerialPort.list;
  SerialPort.list = async () => [];
  context.after(() => { SerialPort.list = originalList; });
  const detector: DatalogicHidDetector = { detect: async () => null };
  const adapter = new QW2100Adapter(config, detector);

  await assert.rejects(adapter.connect(), /USB-KBD\/HID o USB-COM-STD/);
  assert.equal(adapter.getStatus(), "error");
});
