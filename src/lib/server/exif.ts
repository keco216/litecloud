import exifr from 'exifr';
import { db } from './db';
import { fileMetadata } from './db/schema';
import { nanoid } from 'nanoid';

export interface ExifData {
	dateTaken: Date | null;
	latitude: number | null;
	longitude: number | null;
	camera: string | null;
	width: number | null;
	height: number | null;
}

export async function extractExif(buffer: ArrayBuffer): Promise<ExifData> {
	try {
		const parsed = await exifr.parse(buffer, {
			pick: [
				'DateTimeOriginal', 'CreateDate',
				'GPSLatitude', 'GPSLongitude',
				'Make', 'Model',
				'ImageWidth', 'ImageHeight', 'ExifImageWidth', 'ExifImageHeight'
			],
			gps: true
		});

		if (!parsed) return empty();

		const dateTaken = parsed.DateTimeOriginal || parsed.CreateDate || null;
		const camera = [parsed.Make, parsed.Model].filter(Boolean).join(' ') || null;

		return {
			dateTaken: dateTaken instanceof Date ? dateTaken : null,
			latitude: parsed.latitude ?? null,
			longitude: parsed.longitude ?? null,
			camera,
			width: parsed.ExifImageWidth || parsed.ImageWidth || null,
			height: parsed.ExifImageHeight || parsed.ImageHeight || null
		};
	} catch {
		return empty();
	}
}

function empty(): ExifData {
	return { dateTaken: null, latitude: null, longitude: null, camera: null, width: null, height: null };
}

export function storeMetadata(fileId: string, exif: ExifData, extractedText?: string): void {
	db.insert(fileMetadata)
		.values({
			id: nanoid(),
			fileId,
			dateTaken: exif.dateTaken,
			latitude: exif.latitude?.toString() ?? null,
			longitude: exif.longitude?.toString() ?? null,
			camera: exif.camera,
			width: exif.width,
			height: exif.height,
			extractedText: extractedText ?? null
		})
		.run();
}
