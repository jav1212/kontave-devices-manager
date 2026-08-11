import assert from "node:assert/strict";
import test from "node:test";
import { parseClientMessage, PROTOCOL_VERSION } from "../src/protocol/contracts.js";
test("acepta solicitudes de emparejamiento válidas", () => assert.deepEqual(parseClientMessage({ type: "pairing.request", clientName: "Kontave Web", protocolVersion: PROTOCOL_VERSION }), { type: "pairing.request", clientName: "Kontave Web", protocolVersion: 1 }));
test("rechaza mensajes desconocidos", () => assert.equal(parseClientMessage({ type: "admin.execute" }), null));
