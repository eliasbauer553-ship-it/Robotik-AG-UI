'use strict';
const { execFile } = require('child_process');
const { parseLastJson } = require('./parse');

const PYBRICKS_SERVICE = 'c5f50001-8280-46da-89f4-6d8051e4aeef';

// Läuft im Python der Umgebung (bleak ist Abhängigkeit von pybricksdev).
const SCAN_SCRIPT = `
import asyncio, json, sys
from bleak import BleakScanner
SERVICE = "${PYBRICKS_SERVICE}"
async def main(timeout):
    found = {}
    def cb(device, adv):
        uuids = [u.lower() for u in (adv.service_uuids or [])]
        entry = found.setdefault(device.address, {"address": device.address, "name": None, "rssi": None, "pybricks": False})
        if SERVICE in uuids:
            entry["pybricks"] = True
        name = adv.local_name or device.name
        if name:
            entry["name"] = name
        if adv.rssi is not None:
            entry["rssi"] = adv.rssi
    async with BleakScanner(cb):
        await asyncio.sleep(timeout)
    print(json.dumps([e for e in found.values() if e["pybricks"]]))
asyncio.run(main(float(sys.argv[1])))
`;

const TEST_SCRIPT = `
import asyncio, json, sys
from bleak import BleakScanner, BleakClient
async def main(name, address, timeout):
    dev = None
    if name:
        dev = await BleakScanner.find_device_by_name(name, timeout=timeout)
    if dev is None and address:
        dev = await BleakScanner.find_device_by_address(address, timeout=timeout)
    if dev is None:
        print(json.dumps({"ok": False, "error": "No Pybricks hub found (not found)"}))
        return
    async with BleakClient(dev, timeout=timeout) as client:
        print(json.dumps({"ok": bool(client.is_connected), "name": dev.name or name}))
asyncio.run(main(sys.argv[1] or None, sys.argv[2] or None, float(sys.argv[3])))
`;

function runPy(python, script, args, timeoutMs) {
    return new Promise((resolve, reject) => {
        execFile(
            python[0],
            [...python.slice(1), '-c', script, ...args],
            { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, windowsHide: true },
            (error, stdout, stderr) => {
                if (error) {
                    const e = new Error((stderr || error.message || '').trim());
                    e.stderr = stderr;
                    reject(e);
                    return;
                }
                resolve(String(stdout));
            }
        );
    });
}

/** Sucht Pybricks-Hubs in Reichweite. */
async function scan(python, timeoutSec) {
    const out = await runPy(python, SCAN_SCRIPT, [String(timeoutSec)], (timeoutSec + 20) * 1000);
    const list = parseLastJson(out);
    if (!Array.isArray(list)) {
        throw new Error('Unerwartete Antwort vom Bluetooth-Scan.');
    }
    return list
        .map((h) => ({ name: h.name || 'Pybricks Hub', address: h.address, rssi: h.rssi }))
        .sort((a, b) => (b.rssi || -999) - (a.rssi || -999));
}

/** Baut kurz eine Verbindung auf und trennt wieder – prüft, ob der Hub erreichbar ist. */
async function testConnection(python, name, address, timeoutSec) {
    const out = await runPy(python, TEST_SCRIPT, [name || '', address || '', String(timeoutSec)], (timeoutSec + 25) * 1000);
    const res = parseLastJson(out);
    if (!res || typeof res !== 'object') {
        throw new Error('Unerwartete Antwort beim Verbindungstest.');
    }
    return res;
}

module.exports = { scan, testConnection, PYBRICKS_SERVICE };
