import { read, utils } from '@e965/xlsx';

// Define the main Worker handler
export default {
	// Handler function that processes incoming HTTP requests
	async fetch(request, env, ctx): Promise<Response> {
		// Only allow POST requests
		if (request.method !== 'POST') {
			return new Response('Send an XLSX file via POST', { status: 400 });
		}

		// Parse the multipart form data from the request
		const formData = await request.formData();
		// Look for a file field named 'file' in the form data
		const file = formData.get('file');

		// Validate that we received a valid File object
		if (!file || !(file instanceof File)) {
			return new Response('No file uploaded or invalid file', { status: 400 });
		}

		// Convert the file to ArrayBuffer for processing
		const arrayBuffer = await file.arrayBuffer();

		// Read the XLSX file using xlsx library
		// The 'type: array' option tells xlsx to expect a Uint8Array input
		const workbook = read(new Uint8Array(arrayBuffer), { type: 'array' });

		// Get the first sheet from the workbook
		// Note: This only processes the first sheet, ignoring any additional sheets
		const sheetName = workbook.SheetNames[0];
		// Convert the sheet data to JSON format
		// This will use the first row as headers by default
		const jsonData = utils.sheet_to_json(workbook.Sheets[sheetName]);

		// Return the JSON data with proper content type header
		return new Response(JSON.stringify(jsonData, null, 2), {
			headers: { 'Content-Type': 'application/json' },
		});
	},
} satisfies ExportedHandler<Env>;
