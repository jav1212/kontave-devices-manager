import assert from "node:assert/strict";
import test from "node:test";
import { BarcodeParser } from "../src/devices/barcode-scanner/barcode-parser.js";
test("emite un código al recibir CR", () => { const values: string[] = []; const parser = new BarcodeParser((value) => values.push(value)); parser.push(Buffer.from("7591234567890\r")); assert.deepEqual(values, ["7591234567890"]); });
test("soporta lecturas divididas en varios chunks", () => { const values: string[] = []; const parser = new BarcodeParser((value) => values.push(value)); parser.push(Buffer.from("ABC")); parser.push(Buffer.from("-123\n")); assert.deepEqual(values, ["ABC-123"]); });
test("descarta buffers excesivos", () => { const values: string[] = []; const parser = new BarcodeParser((value) => values.push(value), 5); parser.push(Buffer.from("123456\r")); assert.deepEqual(values, []); });
