import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer as createHttpServer, type Server as HttpServer } from "node:http";
import { createServer as createHttpsServer, type Server as HttpsServer } from "node:https";
import { WebSocket, WebSocketServer } from "ws";
import { saveConfig, type ManagerConfig } from "../core/config.js";
import { parseClientMessage, PROTOCOL_VERSION, type ManagerEvent } from "../protocol/contracts.js";

export interface PairingRequest { clientName: string; origin: string }
export class DeviceGateway {
  private server: HttpServer | HttpsServer | null = null; private sockets: WebSocketServer | null = null; private authenticated = new WeakSet<WebSocket>();
  private latestStatus: ManagerEvent = { type: "device.status", device: null, status: "disconnected" };
  constructor(private readonly config: ManagerConfig, private readonly version: string, private readonly approve: (request: PairingRequest) => Promise<boolean>) {}
  async start(): Promise<string> {
    const secure = Boolean(this.config.tlsPfxPath);
    this.server = secure ? createHttpsServer({ pfx: readFileSync(this.config.tlsPfxPath!), passphrase: this.config.tlsPfxPassphrase }) : createHttpServer();
    this.sockets = new WebSocketServer({ server: this.server, maxPayload: 4096, verifyClient: ({ origin }, done) => done(this.config.allowedOrigins.includes(origin), 403, "Origin not allowed") });
    this.sockets.on("connection", (socket, request) => {
      const origin = request.headers.origin ?? ""; const token = new URL(request.url ?? "/", "http://localhost").searchParams.get("token"); const paired = this.verify(token);
      if (paired) this.authenticated.add(socket);
      this.send(socket, { type: "manager.hello", protocolVersion: PROTOCOL_VERSION, managerVersion: this.version, paired });
      if (paired) this.send(socket, this.latestStatus);
      socket.on("message", (raw) => void this.onMessage(socket, origin, raw.toString()));
    });
    await new Promise<void>((resolve, reject) => { this.server!.once("error", reject); this.server!.listen(this.config.websocketPort, "127.0.0.1", resolve); });
    return `${secure ? "wss" : "ws"}://localhost:${this.config.websocketPort}`;
  }
  broadcast(event: ManagerEvent): void { if (event.type === "device.status") this.latestStatus = event; this.sockets?.clients.forEach((socket) => { if (socket.readyState === WebSocket.OPEN && this.authenticated.has(socket)) this.send(socket, event); }); }
  async stop(): Promise<void> { this.sockets?.clients.forEach((socket) => socket.close(1001, "Manager stopping")); await new Promise<void>((resolve) => this.sockets?.close(() => resolve()) ?? resolve()); await new Promise<void>((resolve) => this.server?.close(() => resolve()) ?? resolve()); }
  private async onMessage(socket: WebSocket, origin: string, raw: string): Promise<void> {
    try {
      const message = parseClientMessage(JSON.parse(raw) as unknown); if (!message) return socket.close(1003, "Invalid message");
      if (message.protocolVersion !== PROTOCOL_VERSION) return this.send(socket, { type: "manager.error", code: "PROTOCOL_MISMATCH", message: "Actualiza Kontave o Kontave Device Manager." });
      if (message.type === "client.hello") return;
      const approved = await this.approve({ clientName: message.clientName, origin });
      if (!approved) return this.send(socket, { type: "pairing.result", approved: false, message: "Solicitud rechazada" });
      const token = `${randomUUID()}.${randomBytes(24).toString("base64url")}`; this.config.pairingTokenHash = this.hash(token); saveConfig(this.config); this.authenticated.add(socket);
      this.send(socket, { type: "pairing.result", approved: true, token }); this.send(socket, this.latestStatus);
    } catch { socket.close(1003, "Invalid JSON"); }
  }
  private verify(token: string | null): boolean { if (!token || !this.config.pairingTokenHash) return false; const a = Buffer.from(this.hash(token)); const b = Buffer.from(this.config.pairingTokenHash); return a.length === b.length && timingSafeEqual(a, b); }
  private hash(token: string): string { return createHash("sha256").update(token).digest("hex"); }
  private send(socket: WebSocket, event: ManagerEvent): void { socket.send(JSON.stringify(event)); }
}
