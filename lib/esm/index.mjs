import path from "path";
import fs from "fs-extra";
import snappy from "snappy";
import crypto from "crypto";
import Dict from "./dict.mjs";
import BufferCache from "./buffer.mjs";
import { Worker } from "worker_threads"

/**
 * Define Types
 *
 * @typedef {{folder: string, expire: number, autoCompress: bool, log: bool, peakDuration: bool}} ConfigType
 * @typedef {{expire: number, compress: boolean, search: Array<string>}} OptionsMetadata
 * @typedef {{createdAt: number, updatedAt: number, path: string, options: OptionsMetadata}} DataMetadata
 */

/**
 * @type {ConfigType}
 */
const configDefault = {
	folder: path.join(process.cwd(), "cache"),
	expire: 0,
	autoCompress: false,
	log: false,
	peakDuration: 3000,
};

/**
 * @type {OptionsMetadata}
 */
const optionDefault = {
	expire: 0,
	compress: false,
	search: [],
};

class CacheFile {
	/**
	 * Handle buffer when query
	 * 
	 * @private
	 * @type {Buffer}
	 */
	#buffer = null;

	/**
	 * Handle expire time data
	 * 
	 * @private
	 * @type {Map}
	 */
	#timers = null;

	/**
	 * Handle expire time data
	 * 
	 * @private
	 * @type {ConfigType}
	 */
	#config;


	/**
	 * Handle expire time data
	 * 
	 * @private
	 * @type {Worker}
	 */
	#worker; 

	constructor(config = configDefault) {
		/**
		 * Constructor for CacheFile
		 * 
		 * @param {Object} [config] - Configuration for CacheFile.
		 * @param {string} [config.folder] - The folder path to store cached files.
		 * @param {number} [config.expire] - Default expiration time in milliseconds.
		 * @param {boolean} [config.autoCompress] - Automatically compress cached data.
		 * @param {boolean} [config.log] - Enable or disable logging.
		 * 
		 * @example
		 * const CacheFile = require('./CacheFile');
		 * const cache = new CacheFile({ folder: './my-cache', log: true });
		 */
		this.#config = config;
		this.#timers = new Map();

		if (0 < this.#config.peakDuration) {
			this.#buffer = new BufferCache(this.#config.peakDuration);
		}

		this.#worker = new Worker(path.resolve(__dirname, 'workers/delete.worker.mjs'));
	}

	getBuffer() {
		return this.#buffer;
	}

	getTimers() {
		return this.#timers;
	}

	async set(key, content, options = { compress: false, expire: 0, search: [] }) {
		const fileName = crypto.createHash("sha256").update(key).digest("hex");
		const filePath = `${fileName}.kncch`;

		if (options.compress || this.#config.autoCompress) {
			content = await this.#compress(content);
		}

		await fs.outputFile(path.resolve(this.#config.folder, filePath), content)
			.then(async () => {
				this.#log(`Saved Cache: ${key}`);
				await this.#updateMetadata(key, filePath, {
					...optionDefault,
					...options,
					compress: options.compress || this.#config.autoCompress,
				});
				const expire = options.expire || this.#config.expire;

				if (0 < expire) {
					this.#deleteAfterTimeout(filePath, key, expire);
				} else {
					this.#clearDeleteTimeout(key);
				}
			})
			.catch((err) => console.error(err));
	}

	async exist(key) {
		return await this.#readMetadata(key);
	}

	async get(key) {
		const metadata = await this.#readMetadata(key);

		if (!metadata) {
			throw new Error("BAMIMI CACHE| Key does not exist");
		}

		if (this.#buffer && this.#buffer.has(key)) {
			return await this.#buffer.get(key);
		}

		let result = await fs.readFile(path.resolve(this.#config.folder, metadata.path), "utf8");

		if (metadata.options.compress) {
			result = await this.#uncompress(result);
		}

		if (this.#buffer) {
			this.#buffer.set(key, result);
		}

		return result;
	}

	async del(key) {
		const metadata = await this.#readMetadata(key);
		if (metadata) {
			if (0 < metadata.options.expire) {
				this.#clearDeleteTimeout(key);
			}

			await fs.remove(path.resolve(this.#config.folder, metadata.path))
				.then(async () => {
					this.#log(`Deleted Cache: ${key}`);
					await this.#deleteMetadata(key);

					if (this.#buffer) {
						this.#buffer.del(key)
					}
				})
				.catch((err) =>
					console.error(`BAMIMI CACHE| Error deleting cache at ${metadata.path}:`, err)
				);
		}
	}

	async search(keywords, logic = "AND") {
		return this.dict.search(keywords, logic);
	}

	async setup() {
		const folderPath = this.#config.folder
		fs.ensureDir(folderPath)
			.then(() => {
				this.#log(`Initialized folder: ${folderPath}`);
			})
			.catch((err) => console.error(err))
			.finally(async () => {
				const metadataPath = path.resolve(folderPath, "metadata.json");
				let metadata = {}
				// check metadata exist
				if (fs.existsSync(metadataPath)) {
					// update config with metadata current
					metadata = await fs.readJSON(metadataPath)

					if (metadata.dict) {
						this.dict = new Dict(metadata.dict)
					} else {
						this.dict = new Dict()
					}

					const currentDate = new Date().getTime();
					for (const [key, value] of Object.entries(metadata.data)) {
						if (value.options.expire > 0) {
							const diff = value.options.expire - (currentDate - value.updatedAt)
							const expireT = diff > 0 ? diff : 1;
							this.#deleteAfterTimeout(value.path, key, expireT)
						}
					}

					if (0 < metadata.peakDuration) {
						this.#buffer = new BufferCache(metadata.peakDuration)
					}
				} else {
					this.dict = new Dict()
				}

				metadata = {
					data: {},
					...metadata,
					createdAt: new Date().getTime(),
					autoCompress: this.#config.autoCompress,
					peakDuration: this.#config.peakDuration,
					path: folderPath,
					updatedAt: new Date().getTime(),
					dict: this.dict.index,
				};
				fs.writeJSON(metadataPath, metadata);
			});
	}

	async #updateMetadata(key, filePath, options) {
		const metadataPath = path.resolve(this.#config.folder, "metadata.json");
		const metadata = await fs.readJSON(metadataPath);

		if (metadata.data[key]) {
			metadata.data[key].options = options;
			metadata.data[key].updatedAt = new Date().getTime();
		} else {
			const createdAt = new Date().getTime();
			metadata.data[key] = {
				path: filePath,
				createdAt,
				updatedAt: createdAt,
				options,
			};
		}

		if (options.search && options.search.length) {
			for (const value of options.search) {
				this.dict.addToDict(value, key);
			}

			metadata.dict = this.dict.index;
		}

		await fs.writeJSON(metadataPath, metadata)
			.then(() => {
				this.#log(`Updated Metadata`);
			})
			.catch((err) => console.error(err));
	}

	async #deleteMetadata(key) {
		const metadataPath = path.resolve(this.#config.folder, "metadata.json");

		const metadata = await fs.readJSON(metadataPath);
		if (metadata.data[key]) {
			delete metadata.data[key];
			this.dict.removeValue(key);
			metadata.dict = this.dict.index;
			if (this.#buffer) {
				this.#buffer.del(key);
			}
		}
		await fs.writeJSON(metadataPath, metadata)
			.then(() => {
				this.#log(`Updated Metadata`);
			})
			.catch((err) => console.error(err));
	}

	async #readMetadata(key) {
		const metadataPath = path.resolve(this.#config.folder, "metadata.json");
		const metadata = await fs.readJSON(metadataPath);
		return metadata.data[key] || null;
	}

	#deleteAfterTimeout(filePath, key, timeout) {
			// check timeout in timers and clear if it
			if (this.#timers.has(key)) {
				clearTimeout(this.#timers.get(key));
				this.#timers.delete(key);
			}
	
			// clear new timeout
			const timer = setTimeout(async () => {
				try {
					this.#worker.postMessage({
						folder: this.#config.folder,
						filePath,
						key,
					});
	
					this.#worker.on('message', async (message) => {
						if (message.status === 'success') {
							this.#log(`Deleted key: ${message.key}`);
							await this.#deleteMetadata(message.key);
						} else {
							console.error(`BAMIMI CACHE| Error deleting key ${message.key}:`, message.error);
						}
	
						this.#worker.terminate();
					});
	
					this.#worker.on('error', (error) => {
						console.error(`BAMIMI CACHE| Worker error:`, error);
						this.#worker.terminate();
					});
	
					this.#worker.on('exit', (code) => {
						if (code !== 0) {
							console.error(`BAMIMI CACHE| Worker stopped with exit code ${code}`);
						}
					});
	
					await fs.remove(path.resolve(this.#config.folder, filePath));
					this.#log(`Deleted key: ${key}`);
					this.#timers.delete(key); // delete timer in 
					await this.#deleteMetadata(key)
				} catch (err) {
					console.error(`Error deleting file ${filePath}:`, err);
				}
			}, timeout);
	
			//save id of timeout
			this.#timers.set(key, timer);
		}

	#clearDeleteTimeout(key) {
		if (this.#timers.has(key)) {
			clearTimeout(this.#timers.get(key));
			this.#timers.delete(key);
			this.#log(`Deleted expire key: ${key}`);
		}
	}

	async #compress(rawData) {
		return (await snappy.compress(rawData)).toString("base64");
	}

	async #uncompress(compressedData) {
		const compressedBuffer = Buffer.from(compressedData, "base64");
		return (await snappy.uncompress(compressedBuffer, { asBuffer: false })).toString();
	}

	#log(message) {
		if (this.#config.log) {
			console.log(`BAMIMI CACHE| ${message}`);
		}
	}
}

export default CacheFile;
