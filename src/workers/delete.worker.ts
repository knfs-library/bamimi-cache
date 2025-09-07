/**
 * @module DeleteWorker
 */

const { parentPort } = require('worker_threads');
// @ts-ignore
const fs = require('fs-extra');
const path = require('path');

/**
 * Listens for messages from the parent thread to delete a file.
 */
parentPort.on('message', async ({ folder, filePath, key }: { folder: string; filePath: string; key: string }) => {
	try {
		/**
		 * Deletes the file at the specified path.
		 */
		await fs.remove(path.resolve(folder, filePath));
		/**
		 * Posts a success message back to the parent thread.
		 */
		parentPort.postMessage({ status: 'success', key });
	} catch (error: unknown) {
		/**
		 * Posts an error message back to the parent thread if deletion fails.
		 */
		parentPort.postMessage({ status: 'error', key, error: (error as Error).message });
	}
});
