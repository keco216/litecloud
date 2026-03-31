/**
 * Direct ClamAV daemon (clamd) TCP client.
 *
 * Uses only the built-in Node.js `net` module — no npm dependencies.
 * Implements the clamd protocol: PING, VERSION, INSTREAM.
 *
 * Protocol reference (clamd man page):
 *   - Commands are prefixed with 'z' and NULL-terminated.
 *   - INSTREAM: send "zINSTREAM\0", then chunks as 4-byte big-endian
 *     length + data, terminated by 4 zero bytes.
 *   - Responses end with \0 and contain "OK", "<virus> FOUND", or "ERROR".
 */

import * as net from 'net';
import { createReadStream } from 'fs';
import type { Readable } from 'stream';

export interface ClamdClientOptions {
	host: string;
	port: number;
	timeout?: number; // ms, default 30000
	chunkSize?: number; // bytes per INSTREAM chunk, default 64KB
}

export interface ScanResult {
	isInfected: boolean;
	viruses: string[];
	raw: string; // raw response from clamd
}

const NULL = Buffer.from([0x00]);
const INSTREAM_END = Buffer.alloc(4, 0); // 4 zero bytes

/**
 * Send a simple command (PING, VERSION) and return the response string.
 */
function sendCommand(
	host: string,
	port: number,
	command: string,
	timeout: number
): Promise<string> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		const socket = net.createConnection({ host, port }, () => {
			// Send z-prefixed, NULL-terminated command
			socket.write(`z${command}\0`);
		});

		socket.setTimeout(timeout);

		socket.on('data', (data: Buffer) => {
			chunks.push(data);
		});

		socket.on('end', () => {
			const response = Buffer.concat(chunks).toString('utf8').replace(/\0/g, '').trim();
			resolve(response);
		});

		socket.on('timeout', () => {
			socket.destroy();
			reject(new Error(`clamd command "${command}" timed out after ${timeout}ms`));
		});

		socket.on('error', (err) => {
			reject(new Error(`clamd command "${command}" failed: ${err.message}`));
		});
	});
}

/**
 * Send PING, expect PONG.
 */
export async function ping(options: ClamdClientOptions): Promise<boolean> {
	const timeout = options.timeout ?? 30_000;
	try {
		const response = await sendCommand(options.host, options.port, 'PING', timeout);
		return response === 'PONG';
	} catch {
		return false;
	}
}

/**
 * Send VERSION, return the version string.
 */
export async function version(options: ClamdClientOptions): Promise<string> {
	const timeout = options.timeout ?? 30_000;
	return sendCommand(options.host, options.port, 'VERSION', timeout);
}

/**
 * Parse a clamd scan response line.
 *
 * Examples:
 *   "stream: OK"                          -> clean
 *   "stream: Eicar-Signature FOUND"       -> infected
 *   "stream: Win.Test.EICAR_HDB-1 FOUND" -> infected
 *   "INSTREAM size limit exceeded. ERROR" -> error (treated as clean + throws)
 */
function parseResponse(raw: string): ScanResult {
	const trimmed = raw.replace(/\0/g, '').trim();

	if (trimmed.endsWith('ERROR')) {
		throw new Error(`clamd error: ${trimmed}`);
	}

	const viruses: string[] = [];
	// Response may contain multiple lines (one per match in ALLMATCHSCAN)
	for (const line of trimmed.split('\n')) {
		const match = line.match(/:\s+(.+)\s+FOUND$/);
		if (match) {
			viruses.push(match[1].trim());
		}
	}

	return {
		isInfected: viruses.length > 0,
		viruses,
		raw: trimmed
	};
}

/**
 * Scan a Readable stream via INSTREAM.
 *
 * Protocol:
 *   1. Send "zINSTREAM\0"
 *   2. For each chunk: send 4-byte big-endian length, then chunk data
 *   3. Send 4 zero bytes to signal end
 *   4. Read response
 */
export function scanStream(
	stream: Readable,
	options: ClamdClientOptions
): Promise<ScanResult> {
	const timeout = options.timeout ?? 30_000;
	const chunkSize = options.chunkSize ?? 64 * 1024;

	return new Promise((resolve, reject) => {
		const responseChunks: Buffer[] = [];
		let finished = false;

		function done(err?: Error) {
			if (finished) return;
			finished = true;
			stream.removeAllListeners();
			if (err) {
				reject(err);
			} else {
				const raw = Buffer.concat(responseChunks).toString('utf8');
				try {
					resolve(parseResponse(raw));
				} catch (parseErr) {
					reject(parseErr);
				}
			}
		}

		const socket = net.createConnection({ host: options.host, port: options.port }, () => {
			// Initiate INSTREAM
			socket.write('zINSTREAM\0');

			// Pipe the readable stream in chunks with length prefixes
			stream.on('data', (data: Buffer) => {
				const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);

				// Split into chunkSize pieces if needed
				for (let offset = 0; offset < buf.length; offset += chunkSize) {
					const slice = buf.subarray(offset, offset + chunkSize);
					const lengthBuf = Buffer.alloc(4);
					lengthBuf.writeUInt32BE(slice.length, 0);
					socket.write(lengthBuf);
					socket.write(slice);
				}
			});

			stream.on('end', () => {
				// Send zero-length chunk to terminate
				socket.write(INSTREAM_END);
			});

			stream.on('error', (err) => {
				socket.destroy();
				done(new Error(`Stream error: ${err.message}`));
			});
		});

		socket.setTimeout(timeout);

		socket.on('data', (data: Buffer) => {
			responseChunks.push(data);
		});

		socket.on('end', () => {
			done();
		});

		socket.on('timeout', () => {
			socket.destroy();
			done(new Error(`clamd INSTREAM timed out after ${timeout}ms`));
		});

		socket.on('error', (err) => {
			done(new Error(`clamd INSTREAM failed: ${err.message}`));
		});
	});
}

/**
 * Scan a file by path via INSTREAM.
 * Reads the file locally and streams it to clamd over TCP.
 */
export async function scanFile(
	filePath: string,
	options: ClamdClientOptions
): Promise<ScanResult> {
	const stream = createReadStream(filePath, {
		highWaterMark: options.chunkSize ?? 64 * 1024
	});
	return scanStream(stream, options);
}

/**
 * Convenience: create a reusable client object.
 */
export function createClient(options: ClamdClientOptions) {
	return {
		ping: () => ping(options),
		version: () => version(options),
		scanStream: (stream: Readable) => scanStream(stream, options),
		scanFile: (filePath: string) => scanFile(filePath, options)
	};
}
