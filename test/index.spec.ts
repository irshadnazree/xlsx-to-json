// test/index.spec.ts

/**
 * This test suite verifies the functionality of a Cloudflare Worker that converts Excel files to JSON.
 * The worker accepts both XLSX and XLS files via POST requests and returns their contents as JSON.
 */

import { utils, write } from '@e965/xlsx';
import { describe, expect, it } from 'vitest';
import worker from '../src/index';

describe('Excel to JSON Worker', () => {
	/**
	 * Test case: Verify that the worker only accepts POST requests
	 */
	it('should reject non-POST requests', async () => {
		const request = new Request('http://example.com', {
			method: 'GET',
		});

		const response = await worker.fetch(request);
		expect(response.status).toBe(405);
		expect(await response.text()).toBe('Method Not Allowed');
	});

	/**
	 * Test case: Verify that the worker requires a file in the form data
	 */
	it('should reject requests without a file', async () => {
		const formData = new FormData();
		const request = new Request('http://example.com', {
			method: 'POST',
			body: formData,
		});

		const response = await worker.fetch(request);
		expect(response.status).toBe(400);
		expect(await response.text()).toBe('Invalid file upload');
	});

	/**
	 * Test case: Verify successful XLSX to JSON conversion
	 */
	it('should successfully convert XLSX to JSON', async () => {
		// Create a test XLSX workbook with sample data
		const workbook = utils.book_new();
		const testData = [
			['Name', 'Age', 'City'],
			['John Doe', 30, 'New York'],
			['Jane Smith', 25, 'Los Angeles'],
		];
		const worksheet = utils.aoa_to_sheet(testData);
		utils.book_append_sheet(workbook, worksheet, 'Sheet1');

		// Convert the workbook to a binary format
		const xlsxData = new Uint8Array(write(workbook, { type: 'array', bookType: 'xlsx' }));

		// Prepare the form data with the XLSX file
		const formData = new FormData();
		formData.append(
			'file',
			new File([xlsxData], 'test.xlsx', {
				type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			})
		);

		const request = new Request('http://example.com', {
			method: 'POST',
			body: formData,
		});

		const response = await worker.fetch(request);
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('application/json');
		expect(response.headers.get('X-Processing-Time')).toBeDefined();
		expect(response.headers.get('X-File-Type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

		// Verify the JSON structure matches our input data
		const jsonResponse = await response.json();
		expect(jsonResponse).toEqual(testData);
	});

	/**
	 * Test case: Verify successful XLS to JSON conversion
	 */
	it('should successfully convert XLS to JSON', async () => {
		// Create a test XLS workbook with sample data
		const workbook = utils.book_new();
		const testData = [
			['Product', 'Price', 'Quantity'],
			['Widget A', 19.99, 100],
			['Widget B', 29.99, 50],
		];
		const worksheet = utils.aoa_to_sheet(testData);
		utils.book_append_sheet(workbook, worksheet, 'Sheet1');

		// Convert the workbook to a binary format (XLS)
		const xlsData = new Uint8Array(write(workbook, { type: 'array', bookType: 'xls' }));

		// Prepare the form data with the XLS file
		const formData = new FormData();
		formData.append(
			'file',
			new File([xlsData], 'test.xls', {
				type: 'application/vnd.ms-excel',
			})
		);

		const request = new Request('http://example.com', {
			method: 'POST',
			body: formData,
		});

		const response = await worker.fetch(request);
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('application/json');
		expect(response.headers.get('X-Processing-Time')).toBeDefined();
		expect(response.headers.get('X-File-Type')).toBe('application/vnd.ms-excel');

		// Verify the JSON structure matches our input data
		const jsonResponse = await response.json();
		expect(jsonResponse).toEqual(testData);
	});

	/**
	 * Test case: Verify handling of empty Excel files
	 */
	it('should handle empty Excel files', async () => {
		// Create an empty Excel workbook
		const workbook = utils.book_new();
		const worksheet = utils.aoa_to_sheet([]);
		utils.book_append_sheet(workbook, worksheet, 'Sheet1');

		const xlsxData = new Uint8Array(write(workbook, { type: 'array', bookType: 'xlsx' }));

		const formData = new FormData();
		formData.append(
			'file',
			new File([xlsxData], 'empty.xlsx', {
				type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			})
		);

		const request = new Request('http://example.com', {
			method: 'POST',
			body: formData,
		});

		const response = await worker.fetch(request);
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('application/json');

		const jsonResponse = await response.json();
		expect(jsonResponse).toEqual([]);
	});

	/**
	 * Test case: Verify file size limit enforcement
	 */
	it('should reject files exceeding size limit', async () => {
		// Create a mock large file that exceeds the 5MB limit
		const largeBuffer = new Uint8Array(6 * 1024 * 1024); // 6MB

		const formData = new FormData();
		formData.append(
			'file',
			new File([largeBuffer], 'large.xlsx', {
				type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			})
		);

		const request = new Request('http://example.com', {
			method: 'POST',
			body: formData,
		});

		const response = await worker.fetch(request);
		expect(response.status).toBe(413);
		expect(await response.text()).toBe('File exceeds 5MB limit');
	});

	/**
	 * Test case: Verify MIME type validation
	 */
	it('should reject files with invalid MIME type', async () => {
		const formData = new FormData();
		formData.append('file', new File(['invalid content'], 'test.txt', { type: 'text/plain' }));

		const request = new Request('http://example.com', {
			method: 'POST',
			body: formData,
		});

		const response = await worker.fetch(request);
		expect(response.status).toBe(400);
		expect(await response.text()).toBe('Invalid file type. Please upload an Excel file (XLSX or XLS)');
	});
});
