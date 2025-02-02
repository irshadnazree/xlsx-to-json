/**
 * Excel to JSON Converter Worker
 * Converts Excel files (XLSX/XLS) to structured JSON format with optimized performance.
 */
import { read, utils } from '@e965/xlsx';

// Maximum file size allowed (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Supported Excel file MIME types
const EXCEL_MIME_TYPES = {
	xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	xls: 'application/vnd.ms-excel',
};

/**
 * Validates if the provided MIME type is a supported Excel format
 * @param mimeType - The MIME type to check
 * @returns True if the MIME type is supported, false otherwise
 */
const isValidExcelType = (mimeType: string): boolean => {
	return EXCEL_MIME_TYPES.xlsx === mimeType || EXCEL_MIME_TYPES.xls === mimeType;
};

/**
 * Converts raw Excel data into a structured JSON format
 * Uses optimized array operations for better performance
 * @param data - Raw Excel data as array of arrays
 * @returns Formatted JSON object with data rows and metadata
 */
const formatExcelData = (data: any[][]): Record<string, any> => {
	if (data.length === 0) return {};

	const headersRow = data[0];
	const headers: string[] = new Array(headersRow.length);

	// Process headers in a single pass for better performance
	for (let i = 0; i < headersRow.length; i++) {
		headers[i] = String(headersRow[i]).trim();
	}

	const rows = data.length - 1;
	const cols = headers.length;
	const result = new Array(rows);

	// Process each row using direct array access for better performance
	for (let rowIndex = 1; rowIndex < data.length; rowIndex++) {
		const currentRow = data[rowIndex];
		const rowObject: Record<string, any> = {};

		// Map each column value to its corresponding header
		for (let colIndex = 0; colIndex < cols; colIndex++) {
			rowObject[headers[colIndex]] = currentRow[colIndex] ?? null;
		}

		result[rowIndex - 1] = rowObject;
	}

	// Return structured JSON with metadata
	return {
		data: result,
		totalRows: rows,
		totalColumns: cols,
	};
};

/**
 * Cloudflare Worker handler for processing Excel file uploads
 * Implements file validation, processing, and error handling
 */
export default {
	async fetch(request: Request): Promise<Response> {
		try {
			// Only accept POST requests
			if (request.method !== 'POST') {
				return new Response('Method Not Allowed', { status: 405 });
			}

			// Extract and validate file from form data
			const formData = await request.formData();
			const file = formData.get('file');

			if (!file || !(file instanceof File)) {
				return new Response('Invalid file upload', { status: 400 });
			}

			// Check file size limit
			if (file.size > MAX_FILE_SIZE) {
				return new Response(`File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`, { status: 413 });
			}

			// Validate Excel file type
			if (!isValidExcelType(file.type)) {
				return new Response('Invalid file type. Please upload an Excel file (XLSX or XLS)', { status: 400 });
			}

			// Process the Excel file
			const arrayBuffer = await file.arrayBuffer();
			const processingStart = performance.now();

			// Read Excel file with optimized settings
			const workbook = read(arrayBuffer, {
				type: 'array', // Use array buffer for better performance
				sheets: 0, // Only process first sheet
				cellHTML: false, // Disable HTML parsing
				cellText: false, // Disable text formatting
				sheetStubs: false, // Skip empty cells
				dense: true, // Use dense array format
				bookVBA: false, // Disable VBA macros
			});

			// Convert sheet to raw data array
			const sheet = workbook.Sheets[workbook.SheetNames[0]];
			const rawData = utils.sheet_to_json(sheet, {
				header: 1, // Use first row as headers
				defval: null, // Use null for empty cells
				raw: true, // Get raw values
			}) as any[][];

			// Format data and calculate processing time
			const jsonData = formatExcelData(rawData);
			const processingTime = performance.now() - processingStart;

			// Return JSON response with performance metrics
			return new Response(JSON.stringify(jsonData), {
				headers: {
					'Content-Type': 'application/json',
					'X-Processing-Time': `${processingTime.toFixed(2)}ms`,
				},
			});
		} catch (error) {
			// Log and return error response
			console.error(`Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
			return new Response('Error processing Excel file', { status: 500 });
		}
	},
} satisfies ExportedHandler;
