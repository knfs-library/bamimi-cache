const { parentPort } = require('worker_threads');
const fs = require('fs-extra');
const path = require('path');

parentPort.on('message', async ({ folder, filePath, key }) => {
	try {
		await fs.remove(path.resolve(folder, filePath));
		parentPort.postMessage({ status: 'success', key });
	} catch (error) {
		parentPort.postMessage({ status: 'error', key, error: error.message });
	}
});
