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

/**
 * Define Types
 *
 * @typedef {{folder: string, expire: number, autoCompress: bool, log: bool, peakDuration: bool}} config
 * @typedef {{expire: number, compress: boolean, search: Array<string>}} OptionsMetadata
 * @typedef {{createdAt: number, updatedAt: number, path: string, options: OptionsMetadata}} DataMetadata
 */

/**
 * @type {config}
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

	constructor(config = null) {
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
		this.config = { ...configDefault, ...config };
		this.#timers = new Map()

		if (0 < this.config.peakDuration) {
			this.#buffer = new BufferCache(this.config.peakDuration)
		}

		this.#initFolder(this.config.folder);
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
		let fileName = crypto.createHash("sha256").update(key).digest("hex");
		const filePath = `${fileName}.kncch`;
		if (options.compress || this.config.autoCompress) {
			content = await this.#compress(content);
		}

		await fs.outputFile(path.resolve(this.config.folder, filePath), content)
			.then(async () => {
				this.#log(`Saved Cache: ${key}`);
				await this.#updateMetadata(key, filePath, {
					...optionDefault,
					...options,
					compress: options.compress || this.config.autoCompress,
				});
				const expire = options.expire || this.config.expire;

				if (0 < expire) {
					this.#deleteAfterTimeout(filePath, key, expire);
				} else {
					this.#clearDeleteTimeout(key)
				}
			})
			.catch((err) => console.error(err));
	}

	/**
	 * Checks if a key exists in the cache.
	 *
	 * @param {String} key - The key to check.
	 * @returns {Promise<DataMetadata|null>} - Metadata of the key if it exists, or null.
	 * 
	 * @example
	 * const exists = await cache.exist('user123');
	 * console.log(exists ? 'Key exists' : 'Key does not exist');
	 */
	async exist(key) {
		return await this.#readMetadata(key);
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
		const metadata = await this.#readMetadata(key);

		if (!metadata) {
			throw new Error("BAMIMI CACHE| Key does not exist");
		}

		if (this.#buffer && this.#buffer.has(key)) {
			return await this.#buffer.get(key)
		}

		let result = await fs.readFile(path.resolve(this.config.folder, metadata.path), "utf8");

		if (metadata.options.compress) {
			result = await this.#uncompress(result);
		}

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
			await fs.remove(path.resolve(this.config.folder, metadata.path))
				.then(async () => {
					this.#log(`Deleted Cache: ${key}`);
					await this.#deleteMetadata(key);
				})
				.catch((err) =>
					console.error(`BAMIMI CACHE| Error deleting cache at ${metadata.path}:`, err)
				);
		}
	}

	/**
	 * Searches cached entries based on keywords and logic.
	 *
	 * @param {Array<string>} keywords - Keywords to search for.
	 * @param {String} logic - Logic to apply ("AND" or "OR").
	 * @returns {Promise<Array>} - Matching cache entries.
	 * 
	 * @example
	 * const results = await cache.search(['keyword1', 'keyword2'], 'AND');
	 * console.log(results);
	 */
	async search(keywords, logic = "AND") {
		return this.dict.search(keywords, logic)
	}

	/**
	 * Initializes the cache folder.
	 *
	 * @param {String} folderPath - The path of the folder to initialize.
	 * @private
	 */
	#initFolder(folderPath) {
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
							let expireT = (value.options.expire - (currentDate - value.updatedAt)) > 0 ? value.options.expire : 1;
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
					autoCompress: this.config.autoCompress,
					peakDuration: this.config.peakDuration,
					path: folderPath,
					updatedAt: new Date().getTime(),
					dict: this.dict.index,
				};
				fs.writeJSON(metadataPath, metadata);
			});
	}

	/**
	 * Updates metadata for a specific key.
	 *
	 * @param {String} key - The key to update.
	 * @param {String} filePath - Path to the file.
	 * @param {OptionsMetadata} options - Cache options.
	 * @private
	 */
	async #updateMetadata(key, filePath, options) {
		const metadataPath = path.resolve(this.config.folder, "metadata.json");
		// const metadata = require(metadataPath);

		const metadata = await fs.readJSON(metadataPath)

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
				this.dict.addToDict(value, key)
			}

			metadata.dict = this.dict.index
		}

		await fs.writeJSON(metadataPath, metadata)
			.then(() => {
				this.#log(`Updated Metadata`);
			})
			.catch((err) => console.error(err));
	}

	/**
	 * Deletes metadata for a specific key.
	 *
	 * @param {String} key - The key to delete metadata for.
	 * @private
	 */
	async #deleteMetadata(key) {
		const metadataPath = path.resolve(this.config.folder, "metadata.json");

		const metadata = await fs.readJSON(metadataPath)
		if (metadata.data[key]) {
			delete metadata.data[key];
			this.dict.removeValue(key)
			metadata.dict = this.dict.index
			if (this.#buffer) {
				this.#buffer.del(key)
			}
		}
		await fs.writeJSON(metadataPath, metadata)
			.then(() => {
				this.#log(`Updated Metadata`);
			})
			.catch((err) => console.error(err));
	}

	/**
	 * Reads metadata for a specific key.
	 *
	 * @param {String} key - The key to read metadata for.
	 * @returns {DataMetadata|null}
	 * @private
	 */
	async #readMetadata(key) {
		const metadataPath = path.resolve(this.config.folder, "metadata.json");
		const metadata = await fs.readJSON(metadataPath)
		return metadata.data[key] || null;
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
		// check timeout in timers and clear if it
		if (this.#timers.has(key)) {
			clearTimeout(this.#timers.get(key));
			this.#timers.delete(key);
		}

		// clear new timeout
		const timer = setTimeout(async () => {
			try {
				await fs.remove(path.resolve(this.config.folder, filePath));
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
		if (this.config.log) {
			console.log(`BAMIMI CACHE| ${message}`);
		}
	}
}

module.exports = CacheFile;
