
/**
 * @author Kent Phung
 * @email daikhanh9260@gmail.com
 * @version 1.5.1
 * @license MIT
 * @link https://github.com/knfs-library/bamimi-cache
 */
/**
 * @module CacheFile
 * A simple file-based cache system with optional compression and expiration handling.
 * Uses metadata to track cache entries and supports keyword search functionality.
 */
const path = require("path");
const fs = require("fs-extra");
const snappy = require("snappy");
const crypto = require("crypto");
const Dict = require("./dict")
const BufferCache = require("./buffer")
const { Worker } = require('worker_threads');
const EventEmitter = require('events');

/**
 * Define Types
 *
 * @typedef {{folder: string, expire: number, autoCompress: bool, log: bool, peakDuration: number, maxSize: number, logHandle: function, errorHandle: function}} ConfigType
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
	search: []
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
		this.#timers = new Map()

		if (0 < this.#config.peakDuration) {
			this.#buffer = new BufferCache(this.#config.peakDuration)
		}

		this.#worker = new Worker(path.resolve(__dirname, 'workers/delete.worker.js'));

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

	/**
	 * 
	 * @returns {BufferCache}
	 */
	getBuffer() {
		return this.#buffer;
	}

	/**
	 * 
	 * @returns {Map}
	 */
	getTimers() {
		return this.#timers;
	}

	/**
	 * Stores content in the cache.
	 *
	 * @param {String} key - Unique identifier for the cache entry.
	 * @param {String} content - The content to store.
	 * @param {Object} options - Storage options.
	 * @param {boolean} [options.compress] - Whether to compress the content.
	 * @param {number} [options.expire] - Expiration time in milliseconds.
	 * @returns {Promise<void>}
	 * 
	 * @example
	 * await cache.set('user123', JSON.stringify({ name: 'John' }), { expire: 60000 });
	 */
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

	/**
	 * Checks if a key exists in the cache.
	 *
	 * @param {String} key - The key to check.
	 * @returns {bool} - True if it exists, or false.
	 * 
	 * @example
	 * const exists = await cache.exist('user123');
	 * console.log(exists ? 'Key exists' : 'Key does not exist');
	 */
	exist(key) {
		return this.#readMetadata(key) ? true : false;
	}

	/**
	 * Retrieves cached content by key.
	 *
	 * @param {String} key - The key to retrieve content for.
	 * @returns {Promise<String>} - The cached content.
	 * 
	 * @example
	 * const data = await cache.get('user123');
	 * console.log(data);
	 */
	async get(key) {
		if (this.#buffer && this.#buffer.has(key)) {
			return await this.#buffer.get(key)
		}

		const metadata = await this.#readMetadata(key);

		if (!metadata) {
			this.#error("Key does not exist");
		}

		let result = await fs.readFile(path.resolve(this.#config.folder, metadata.path), "utf8");

		if (metadata.options.compress) {
			result = await this.#uncompress(result, metadata);
		}	

		result = this.#reformatData(result,metadata.type)

		if (this.#buffer) {
			this.#buffer.set(key, result)
		}

		return result
	}

	/**
	 * Deletes a cached entry by key.
	 *
	 * @param {String} key - The key to delete.
	 * @returns {Promise<void>}
	 * 
	 * @example
	 * await cache.del('user123');
	 * console.log('Cache deleted');
	 */
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

	/**
	 * Searches cached entries based on keywords and logic.
	 *
	 * @param {Array<string>} keywords - Keywords to search for.
	 * @param {String} logic - Logic to apply ("AND" or "OR").
	 * @returns {Array<string>} - Matching cache entries.
	 * 
	 * @example
	 * const results = await cache.search(['keyword1', 'keyword2'], 'AND');
	 * console.log(results);
	 */
	search(keywords, logic = "AND") {
		return this.dict.search(keywords, logic)
	}

	/**
	 * 
	 * @param {String} key 
	 * @param {String} message 
	 */
	publish(key, message) {
		this.#eventEmitter.emit(key, message)
	}

	/**
	 * 
	 * @param {String} key 
	 * @param {Function} listener 
	 */
	subscribe(key, listener) {
		this.#eventEmitter.on(key, listener);
	}

	/**
	 * Initializes the cache folder.
	 */
	async setup() {
		const folderPath = this.#config.folder
		fs.ensureDir(folderPath)
			.then(() => {
				this.#log(`Initialized folder: ${folderPath}`);
			})
			.catch((err) => this.#error(err.message))
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

	/**
	 * Updates metadata for a specific key.
	 *
	 * @private
	 */
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

	/**
	 * Deletes metadata for a specific key.
	 *
	 * @param {String} key - The key to delete metadata for.
	 * @private
	 */
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

	/**
	 * Reads metadata for a specific key.
	 *
	 * @param {String} key - The key to read metadata for.
	 * @returns {DataMetadata|null>}
	 * @private
	 */
	#readMetadata(key) {
		return this.#metadata.data[key] || null;
	}

	/**
	 * Deletes a file after a timeout.
	 *
	 * @param {String} filePath - The file path to delete.
	 * @param {String} key - The key to delete metadata for.
	 * @param {Number} timeout - Timeout in milliseconds.
	 * @private
	 */
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


	/**
	 * Cancel timeout
	 * @param {String} key - Name file (cache key)
	 */
	#clearDeleteTimeout(key) {
		if (this.#timers.has(key)) {
			clearTimeout(this.#timers.get(key));
			this.#timers.delete(key);
			this.#log(`Deleted expire key: ${key}`);
		}
	}

	/**
	 * Compresses raw data using Snappy.
	 *
	 * @param {String} rawData - The raw data to compress.
	 * @returns {Promise<String>} - The compressed data.
	 * @private
	 */
	async #compress(rawData) {
		return (await snappy.compress(rawData)).toString("base64");
	}

	/**
	 * Decompresses data using Snappy.
	 *
	 * @param {String} compressedData - The compressed data to decompress.
	 * @returns {Promise<String>} - The decompressed data.
	 * @private
	 */
	async #uncompress(compressedData) {
		const compressedBuffer = Buffer.from(compressedData, "base64");
		return (await snappy.uncompress(compressedBuffer, { asBuffer: false })).toString();
	}

	/**
	 * Logs messages if logging is enabled.
	 *
	 * @param {String} message - The message to log.
	 * @private
	 */
	#log(message) {
		if (this.#config.log) {
			this.#config.logHandle(message)
		}
	}

	/**
	 * Errors messages
	 *
	 * @param {String} message - The message to log.
	 * @private
	 */
	#error(message) {
		this.#config.errorHandle(message)
	}

	/**
	 * Format message
	 * 
	 * @param {*} data 
	 * @param {String} type - "Number" | "String" | "Object" 
	 * 
	 * @returns {String}
	 */
	#formatData(data, type = "string") {
		switch (type) {
			case "object":
				return JSON.stringify(data)
			default:
				return String(data)
		}
	}


	/**
	 * Format message
	 * 
	 * @param {String} formattedData 
	 * @param {String} type - "number" | "string" | "object" 
	 * 
	 * @returns {Object | number | string}
	 */
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

module.exports = CacheFile;
