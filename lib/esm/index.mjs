/**
 * @author Kent Phung
 * @email daikhanh9260@gmail.com
 * @version 1.6.3
 * @license MIT
 * @link https://github.com/knfs-library/bamimi-cache
 */

import path from "path";
import fs from "fs-extra";
import snappy from "snappy";
import crypto from "crypto";
import Dict from "./dict.mjs";
import BufferCache from "./buffer.mjs";
import { Worker } from "worker_threads"
import EventEmitter from "events";
/**
 * Define Types
 *
 * @typedef {{folder: string, expire: number, autoCompress: bool, log: bool, peakDuration: number, maxSize: number}} ConfigType
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
	maxSize: 0,
	logHandle: (message) => {
		console.log(`BAMIMI CACHE| ${message}`)
	},
	errorHandle: (message) => {
		throw new Error(`BAMIMI CACHE| ${message}`)
	}
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

	/**
	 * @private
	 * @type {EventEmitter} 
	 */
	#eventEmitter;

	/**
	 * @private
	 * @type {}
	 */
	#metadata = {}

	/**
	 * Handle expire time data
	 * 
	 * @private
	 */
	#updateMetaTimer = null;

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
		this.#config = {
			...configDefault,
			...config
		};
		this.#timers = new Map();

		if (0 < this.#config.peakDuration) {
			this.#buffer = new BufferCache(this.#config.peakDuration);
		}

		this.#worker = new Worker(path.resolve(__dirname, 'workers/delete.worker.mjs'));

		this.#eventEmitter = new EventEmitter();

		this.dict = new Dict()

		this.#metadata = {
			data: {},
			createdAt: new Date().getTime(),
			autoCompress: this.#config.autoCompress,
			peakDuration: this.#config.peakDuration,
			path: this.#config.folder,
			updatedAt: new Date().getTime(),
			dict: this.dict.index,
		}
	}

	getBuffer() {
		return this.#buffer;
	}

	getTimers() {
		return this.#timers;
	}

	async set(key, content, options = {
			compress: false,
			expire: 0,
			search: []
		}) {
			const type = typeof content;
	
			if ('undefined' == type) {
				this.#error(`Content is undefined at key: ${key}`)
				return
			}
	
			content = this.#formatData(content, type)
			const size = Buffer.byteLength(content, 'utf8')
			if (this.#config.maxSize > 0 && size > this.#config.maxSize) {
				this.#error(`Content size is over a ${key}`)
			}
			let fileName = crypto.createHash("md5").update(key).digest("hex");
			const filePath = `${fileName}.kncch`;
			if (options.compress || this.#config.autoCompress) {
				content = await this.#compress(content);
			}
	
			await fs.outputFile(path.resolve(this.#config.folder, filePath), content)
				.then(async () => {
					this.#log(`Saved Cache: ${key}`);
					const dt = {
						path: filePath,
						size,
						type,
						createdAt: new Date().getTime(),
						updatedAt: new Date().getTime(),
						options: {
							...optionDefault,
							...options,
							compress: options.compress || this.#config.autoCompress,
						}
					}
					this.#metadata.data[key] = dt
	
					if (options.search && options.search.length) {
						for (const value of options.search) {
							this.dict.addToDict(value, key)
						}
	
						this.#metadata.dict = this.dict.index
					}
					await this.#updateMetadata();
	
					const expire = options.expire || this.#config.expire;
	
					if (0 < expire) {
						this.#deleteAfterTimeout(filePath, key, expire);
					} else {
						this.#clearDeleteTimeout(key)
					}
				})
				.catch((err) => this.#error(err.message));
		}

	async exist(key) {
		return await this.#readMetadata(key);
	}

	async get(key) {
		if (this.#buffer && this.#buffer.has(key)) {
			return await this.#buffer.get(key);
		}

		const metadata = this.#readMetadata(key);

		if (!metadata) {
			this.#error("Key does not exist");
		}

		let result = await fs.readFile(path.resolve(this.#config.folder, metadata.path), "utf8");

		if (metadata.options.compress) {
			result = await this.#uncompress(result);
		}

		result = this.#reformatData(result, metadata.type)

		if (this.#buffer) {
			this.#buffer.set(key, result);
		}

		return result;
	}

	async del(key) {
		const metadata = await this.#readMetadata(key);
		// clear timeout if exist
		if (0 < metadata.options.expire) {
			this.#clearDeleteTimeout(key)
		}

		if (metadata) {
			await fs.remove(path.resolve(this.#config.folder, metadata.path))
				.then(async () => {
					this.#log(`Deleted Cache: ${key}`);
					await this.#deleteMetadata(key);
					
					if (this.#buffer) {
						this.#buffer.del(key)
					}
				})
				.catch((err) =>
					this.#error(`Error deleting cache at ${metadata.path}: ${err.message}`)
				);
		}
	}

	search(keywords, logic = "AND") {
		return this.dict.search(keywords, logic)
	}

	publish(key, message) {
		this.#eventEmitter.emit(key, message)
	}

	subscribe(key, listener) {
		this.#eventEmitter.on(key, listener);
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

				this.#metadata = {
					data: {},
					...metadata,
					createdAt: new Date().getTime(),
					autoCompress: this.#config.autoCompress,
					peakDuration: this.#config.peakDuration,
					path: folderPath,
					updatedAt: new Date().getTime(),
					dict: this.dict.index,
				};

				await fs.writeJSON(metadataPath, this.#metadata);
			});
	}

	async #updateMetadata() {
		if (this.#updateMetaTimer) {
			clearTimeout(this.#updateMetaTimer)
		}

		this.#updateMetaTimer = setTimeout(async () => {
			const metadataPath = path.resolve(this.#config.folder, "metadata.json");

			await fs.writeJSON(metadataPath, this.#metadata)
				.then(() => {
					this.#log(`Updated Metadata`);
				})
				.catch((err) => this.#error(err.message));
		}, 500)
	}

	async #deleteMetadata(key) {
		if (this.#metadata.data[key]) {
			delete this.#metadata.data[key];
			this.dict.removeValue(key)
			this.#metadata.dict = this.dict.index
			if (this.#buffer) {
				this.#buffer.del(key)
			}
		}
		await this.#updateMetadata()
	}

	#readMetadata(key) {
		return this.#metadata.data[key] || null;
	}

	#deleteAfterTimeout(filePath, key, timeout) {
		// Check and clear existing timer if it exists
		if (this.#timers.has(key)) {
			clearTimeout(this.#timers.get(key));
			this.#timers.delete(key);
		}

		// Set a new timer
		const timer = setTimeout(async () => {
			try {
				this.#worker.postMessage({
					folder: this.#config.folder,
					filePath,
					key,
				});

				const cleanup = () => {
					this.#worker.off('message', messageHandler);
					this.#worker.off('error', errorHandler);
					this.#worker.off('exit', exitHandler);
					this.#worker.terminate();
				};

				const messageHandler = async (message) => {
					if (message.status === 'success') {
						this.#log(`Deleted key: ${message.key}`);
						await this.#deleteMetadata(message.key);
					} else {
						console.error(`BAMIMI CACHE | Error deleting key ${message.key}:`, message.error);
					}
					cleanup();
				};

				const errorHandler = (error) => {
					console.error(`BAMIMI CACHE | Worker error:`, error);
					cleanup();
				};

				const exitHandler = (code) => {
					if (code !== 0) {
						this.#log(`Worker stopped with exit code: ${code}`);
					}
					cleanup();
				};

				this.#worker.on('message', messageHandler);
				this.#worker.on('error', errorHandler);
				this.#worker.on('exit', exitHandler);

				await fs.remove(path.resolve(this.#config.folder, filePath));
				this.#log(`Deleted key: ${key}`);
				this.#timers.delete(key);
				await this.#deleteMetadata(key);
			} catch (err) {
				this.#error(`Error deleting file ${filePath}: ${err.message}`);
			}
		}, timeout);

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
			this.#config.logHandle(message)
		}
	}

	#error(message) {
		this.#config.errorHandle(message)
	}

	#formatData(data, type = "string") {
		switch (type) {
			case "object":
				return JSON.stringify(data)
			default:
				return String(data)
		}
	}
	
	#reformatData(formattedData, type = "string") {
		switch (type) {
			case "object":
				return JSON.parse(formattedData)
			case "number":
				return Number(formattedData)
			default:
				return String(formattedData)
		}
	}
}

export default CacheFile;
