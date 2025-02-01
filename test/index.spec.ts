// test/index.spec.ts

/**
 * This test suite verifies the functionality of a Cloudflare Worker that converts XLSX files to JSON.
 * The worker accepts XLSX files via POST requests and returns their contents as JSON.
 */

// Import necessary testing utilities from Cloudflare's test environment
import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
// Import Vitest testing framework utilities
import { beforeEach, describe, expect, it } from 'vitest';
// Import XLSX library utilities for creating test files
import { utils, write } from '@e965/xlsx';
// Import our worker implementation
import worker from '../src/index';

// Type definition for requests to ensure proper typing in the Cloudflare Workers environment
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('XLSX to JSON Worker', () => {
	// Store the execution context that's required for testing Cloudflare Workers
	let ctx: ReturnType<typeof createExecutionContext>;

	// Before each test, create a fresh execution context to ensure test isolation
	beforeEach(() => {
		ctx = createExecutionContext();
	});

	/**
	 * Test case: Verify that the worker only accepts POST requests
	 * This ensures that our API maintains proper HTTP method restrictions
	 */
	it('should reject non-POST requests', async () => {
		// Create a GET request (which should be rejected)
		const request = new IncomingRequest('http://example.com', {
			method: 'GET',
		});

		const response = await worker.fetch(request, env, ctx);
		// Wait for any background operations to complete
		await waitOnExecutionContext(ctx);

		// Verify that the response indicates a bad request
		expect(response.status).toBe(400);
		expect(await response.text()).toBe('Send an XLSX file via POST');
	});

	/**
	 * Test case: Verify that the worker requires a file in the form data
	 * This ensures proper input validation for file uploads
	 */
	it('should reject requests without a file', async () => {
		// Create an empty form submission
		const formData = new FormData();
		const request = new IncomingRequest('http://example.com', {
			method: 'POST',
			body: formData,
		});

		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		// Verify that the response indicates a bad request
		expect(response.status).toBe(400);
		expect(await response.text()).toBe('No file uploaded or invalid file');
	});

	/**
	 * Test case: Verify successful XLSX to JSON conversion
	 * This tests the main functionality of the worker with a valid XLSX file
	 */
	it('should successfully convert XLSX to JSON', async () => {
		// Create a test XLSX workbook with sample data
		const workbook = utils.book_new();
		const worksheet = utils.aoa_to_sheet([
			['Name', 'Age', 'City'], // Header row
			['John Doe', 30, 'New York'], // Data row 1
			['Jane Smith', 25, 'Los Angeles'], // Data row 2
		]);
		utils.book_append_sheet(workbook, worksheet, 'Sheet1');

		// Convert the workbook to a binary format
		const xlsxData = new Uint8Array(write(workbook, { type: 'array', bookType: 'xlsx' }));

		// Prepare the form data with the XLSX file
		const formData = new FormData();
		formData.append(
			'file',
			new File([xlsxData], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
		);

		// Create a POST request with the form data
		const request = new IncomingRequest('http://example.com', {
			method: 'POST',
			body: formData,
		});

		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		// Verify successful response
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('application/json');

		// Verify the JSON structure matches our input data
		const jsonResponse = await response.json();
		expect(jsonResponse).toEqual([
			{ Name: 'John Doe', Age: 30, City: 'New York' },
			{ Name: 'Jane Smith', Age: 25, City: 'Los Angeles' },
		]);
	});

	/**
	 * Test case: Verify handling of empty XLSX files
	 * This tests edge case handling when the uploaded file contains no data
	 */
	it('should handle empty XLSX files', async () => {
		// Create an empty XLSX workbook
		const workbook = utils.book_new();
		const worksheet = utils.aoa_to_sheet([]); // Empty worksheet
		utils.book_append_sheet(workbook, worksheet, 'Sheet1');

		// Convert the empty workbook to binary format
		const xlsxData = new Uint8Array(write(workbook, { type: 'array', bookType: 'xlsx' }));

		// Prepare form data with the empty XLSX file
		const formData = new FormData();
		formData.append(
			'file',
			new File([xlsxData], 'empty.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
		);

		// Create a POST request with the empty file
		const request = new IncomingRequest('http://example.com', {
			method: 'POST',
			body: formData,
		});

		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		// Verify successful response
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('application/json');

		// Verify that we get an empty array for an empty file
		const jsonResponse = await response.json();
		expect(jsonResponse).toEqual([]);
	});
});
