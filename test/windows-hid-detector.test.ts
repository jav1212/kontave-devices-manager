import assert from "node:assert/strict";
import test from "node:test";
import { parseConnectedDatalogicHidDevices } from "../src/devices/barcode-scanner/windows-hid-detector.js";

test("detecta un lector Datalogic HID sin depender del idioma de Windows", () => {
  const output = [
    "Id. de instancia: HID\\VID_05F9&PID_221C\\7&ABC&0&0000",
    "Descripción del dispositivo: Dispositivo de entrada USB",
    "Instance ID: HID\\VID_1234&PID_5678\\IGNORED",
  ].join("\r\n");
  assert.deepEqual(parseConnectedDatalogicHidDevices(output), [{ instanceId: "HID\\VID_05F9&PID_221C\\7&ABC&0&0000", productId: "221c" }]);
});

test("elimina duplicados y acepta identificadores USB padre", () => {
  const output = [
    "USB\\VID_05F9&PID_221C\\S/N_G14G19153",
    "USB\\VID_05F9&PID_221C\\S/N_G14G19153",
  ].join("\n");
  assert.equal(parseConnectedDatalogicHidDevices(output).length, 1);
});

test("no confunde lectores de otros fabricantes", () => {
  assert.deepEqual(parseConnectedDatalogicHidDevices("HID\\VID_0458&PID_019D\\KEYBOARD"), []);
});
