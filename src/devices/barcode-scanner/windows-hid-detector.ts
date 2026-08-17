import { execFile } from "node:child_process";

export interface DatalogicHidDevice {
  instanceId: string;
  productId: string;
}

export interface DatalogicHidDetector {
  detect(): Promise<DatalogicHidDevice | null>;
}

export function parseConnectedDatalogicHidDevices(output: string): DatalogicHidDevice[] {
  const devices = new Map<string, DatalogicHidDevice>();
  const pattern = /(?:USB|HID)\\VID_05F9&PID_([0-9A-F]{4})\\[^\r\n]+/gi;
  for (const match of output.matchAll(pattern)) {
    const instanceId = match[0];
    devices.set(instanceId.toLowerCase(), { instanceId, productId: match[1].toLowerCase() });
  }
  return [...devices.values()];
}

export class WindowsDatalogicHidDetector implements DatalogicHidDetector {
  async detect(): Promise<DatalogicHidDevice | null> {
    if (process.platform !== "win32") return null;
    const output = await enumerateConnectedHidDevices();
    return parseConnectedDatalogicHidDevices(output)[0] ?? null;
  }
}

function enumerateConnectedHidDevices(): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("pnputil.exe", ["/enum-devices", "/connected", "/class", "HIDClass"], { encoding: "utf8", windowsHide: true, timeout: 5_000, maxBuffer: 256 * 1024 }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}
