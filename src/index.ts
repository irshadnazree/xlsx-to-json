/**
 * This module provides an API endpoint for converting Excel files (XLSX/XLS) to JSON format.
 * It uses the @e965/xlsx library for efficient Excel file processing.
 */
import { read, utils } from '@e965/xlsx';

// Configuration constants for file validation
const MAX_FILE_SIZE = 5 * 1024 * 1024; // Maximum file size limit of 5MB

// Valid Excel MIME types
const EXCEL_MIME_TYPES = {
	xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	xls: 'application/vnd.ms-excel',
};

/**
 * Validates if the given MIME type is a valid Excel format
 * @param mimeType - The MIME type to validate
 * @returns boolean indicating if the MIME type is valid
 */
const isValidExcelType = (mimeType: string): boolean => {
	return Object.values(EXCEL_MIME_TYPES).includes(mimeType);
};

/**
 * Main Worker handler that processes incoming requests
 * Implements the ExportedHandler interface for Cloudflare Workers
 */
export default {
	async fetch(request: Request): Promise<Response> {
		try {
			// Only allow POST requests for file uploads
			if (request.method !== 'POST') {
				return new Response('Method Not Allowed', { status: 405 });
			}

			// Extract the uploaded file from the form data
			const formData = await request.formData();
			const file = formData.get('file');

			// Ensure a valid file was uploaded
			if (!file || !(file instanceof File)) {
				return new Response('Invalid file upload', { status: 400 });
			}

			// Check if file size is within the allowed limit
			if (file.size > MAX_FILE_SIZE) {
				return new Response(`File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`, { status: 413 });
			}

			// Verify that the uploaded file is a valid Excel file
			if (!isValidExcelType(file.type)) {
				return new Response('Invalid file type. Please upload an Excel file (XLSX or XLS)', { status: 400 });
			}

			// Convert the file to an ArrayBuffer for processing
			const arrayBuffer = await file.arrayBuffer();

			// Read the Excel file with optimized settings for better performance
			const workbook = read(new Uint8Array(arrayBuffer), {
				type: 'array', // Process as array buffer
				sheets: 0, // Only parse the first sheet for efficiency
				cellHTML: false, // Disable HTML parsing for better performance
				cellText: false, // Disable text formatting for better performance
				sheetStubs: false, // Ignore empty cells
				dense: true, // Use array-based storage for better memory usage
			});

			// Extract the first sheet and convert it to JSON
			const sheet = workbook.Sheets[workbook.SheetNames[0]];
			const jsonData = utils.sheet_to_json(sheet, {
				header: 1, // Use first row as column headers
				defval: null, // Replace empty cells with null
				raw: true, // Get raw values without formatting
			});

			// Return the JSON data with performance metrics
			return new Response(JSON.stringify(jsonData), {
				headers: {
					'Content-Type': 'application/json',
					'X-Processing-Time': `${performance.now()}ms`, // Include processing time in response headers
					'X-File-Type': file.type, // Include the original file type in response headers
				},
			});
		} catch (error) {
			// Log and handle any errors that occur during processing
			console.error(`Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
			return new Response('Error processing Excel file', { status: 500 });
		}
	},
} satisfies ExportedHandler;
