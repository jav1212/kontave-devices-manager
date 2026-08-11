import { SerialPort } from "serialport";
process.stdout.write(`${JSON.stringify(await SerialPort.list(), null, 2)}\n`);
