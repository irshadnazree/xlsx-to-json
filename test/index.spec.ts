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
	 * Test case: Verify HTTP method validation
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
	 * Test case: Verify file upload validation
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
	 * Test case: Verify XLSX conversion with performance metrics
	 */
	it('should successfully convert XLSX to JSON with performance metrics', async () => {
		// Create test XLSX data
		const workbook = utils.book_new();
		const testData = [
			['Name', 'Age', 'City'],
			['John Doe', 30, 'New York'],
			['Jane Smith', 25, 'Los Angeles'],
		];
		const worksheet = utils.aoa_to_sheet(testData);
		utils.book_append_sheet(workbook, worksheet, 'Sheet1');

		const xlsxData = new Uint8Array(write(workbook, { type: 'array', bookType: 'xlsx' }));
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

		// Verify performance metrics
		const processingTime = response.headers.get('X-Processing-Time');
		expect(processingTime).toBeDefined();
		expect(parseFloat(processingTime!.replace('ms', ''))).toBeGreaterThan(0);

		// Verify JSON structure and data
		const jsonResponse = await response.json();
		expect(jsonResponse).toEqual({
			data: [
				{ Name: 'John Doe', Age: 30, City: 'New York' },
				{ Name: 'Jane Smith', Age: 25, City: 'Los Angeles' },
			],
			totalRows: 2,
			totalColumns: 3,
		});
	});

	/**
	 * Test case: Verify XLS conversion
	 */
	it('should successfully convert XLS to JSON', async () => {
		// Create test XLS data
		const workbook = utils.book_new();
		const testData = [
			['Product', 'Price', 'Quantity'],
			['Widget A', 19.99, 100],
			['Widget B', 29.99, 50],
		];
		const worksheet = utils.aoa_to_sheet(testData);
		utils.book_append_sheet(workbook, worksheet, 'Sheet1');

		const xlsData = new Uint8Array(write(workbook, { type: 'array', bookType: 'xls' }));
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

		const jsonResponse = await response.json();
		expect(jsonResponse).toEqual({
			data: [
				{ Product: 'Widget A', Price: 19.99, Quantity: 100 },
				{ Product: 'Widget B', Price: 29.99, Quantity: 50 },
			],
			totalRows: 2,
			totalColumns: 3,
		});
	});

	/**
	 * Test case: Verify empty file handling
	 */
	it('should handle empty Excel files', async () => {
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
		expect(jsonResponse).toEqual({});
	});

	/**
	 * Test case: Verify file size limit
	 */
	it('should reject files exceeding size limit', async () => {
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
