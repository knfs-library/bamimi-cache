import { parentPort } from 'worker_threads';
import fs from 'fs-extra';
import path from 'path';

parentPort.on('message', async ({ folder, filePath, key }) => {
	try {
		await fs.remove(path.resolve(folder, filePath));
		parentPort.postMessage({ status: 'success', key });
	} catch (error) {
		parentPort.postMessage({ status: 'error', key, error: error.message });
	}
});
