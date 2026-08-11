export class BarcodeParser {
  private buffer = "";
  constructor(private readonly emit: (barcode: string) => void, private readonly maxLength = 128) {}
  push(chunk: Buffer): void { for (const byte of chunk) { if (byte === 10 || byte === 13) { this.flush(); continue; } if (byte >= 32 && byte <= 126) { this.buffer += String.fromCharCode(byte); if (this.buffer.length > this.maxLength) this.buffer = ""; } } }
  reset(): void { this.buffer = ""; }
  private flush(): void { const value = this.buffer.trim(); this.buffer = ""; if (value) this.emit(value); }
}
