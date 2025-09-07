/**
 * @module CacheFile
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
import Dict from "./dict";
import BufferCache from "./buffer";
import { Worker } from 'worker_threads';
import EventEmitter from 'events';

/**
 * Define Types
 */

export interface ConfigType {
	folder: string;
	expire: number;
	autoCompress: boolean;
	log: boolean;
	peakDuration: number;
	maxSize: number;
	logHandle: (message: string) => void;
	errorHandle: (message: string) => void;
	compressionAlgorithm: string;
}

export interface OptionsMetadata {
	expire: number;
	compress: boolean;
	compressionAlgorithm: string;
	search: string[];
}

export interface DataMetadata {
	createdAt: number;
	updatedAt: number;
	path: string;
	options: OptionsMetadata;
	type: string;
	size: number;
}

interface Metadata {
	data: Record<string, DataMetadata>;
	createdAt: number;
	autoCompress: boolean;
	peakDuration: number;
	path: string;
	updatedAt: number;
	dict: Map<string, Set<string>>;
}

const configDefault: ConfigType = {
	folder: path.join(process.cwd(), "cache"),
	expire: 0,
	autoCompress: false,
	log: false,
	peakDuration: 3000,
	maxSize: 0,
	logHandle: (message: string) => {
		console.log(`BAMIMI CACHE| ${message}`)
	},
	errorHandle: (message: string) => {
		throw new Error(`BAMIMI CACHE| ${message}`)
	},
	compressionAlgorithm: 'snappy'
};

const optionDefault: OptionsMetadata = {
	expire: 0,
	compress: false,
	compressionAlgorithm: 'snappy',
	search: []
};

/**
 * CacheFile class for handling file-based caching.
 */
class CacheFile {

	private buffer: BufferCache | null = null;
	private timers: Map<string, NodeJS.Timeout> = new Map();
	private config: ConfigType;
	private worker: Worker;
	private eventEmitter: EventEmitter;
	private metadata: Metadata;
	private updateMetaTimer: NodeJS.Timeout | null = null;
	public dict: Dict;

	/**
	 * Constructor for CacheFile
	 * 
	 * @param {ConfigType} [config] - Configuration for CacheFile.
	 * 
	 * @example
	 * const cache = new CacheFile({ folder: './my-cache', log: true });
	 */
	constructor(config: Partial<ConfigType> = {}) {
		this.config = {
			...configDefault,
			...config
		};

		if (this.config.peakDuration > 0) {
			this.buffer = new BufferCache(this.config.peakDuration);
		}

		this.worker = new Worker(path.resolve(__dirname, 'workers/delete.worker.js'));

		this.worker.on('message', async (message: { status: string; key: string; error?: string }) => {
			if (message.status === 'success') {
				this.log(`Deleted key: ${message.key}`);
				await this.deleteMetadata(message.key);
			} else {
				console.error(`BAMIMI CACHE | Error deleting key ${message.key}:`, message.error);
			}
		});

		this.worker.on('error', (error: Error) => {
			console.error(`BAMIMI CACHE | Worker error:`, error);
		});

		this.worker.on('exit', (code: number) => {
			if (code !== 0) {
				this.log(`Worker stopped with exit code: ${code}`);
			}
		});

		this.eventEmitter = new EventEmitter();
		this.dict = new Dict();

		this.metadata = {
			data: {},
			createdAt: new Date().getTime(),
			autoCompress: this.config.autoCompress,
			peakDuration: this.config.peakDuration,
			path: this.config.folder,
			updatedAt: new Date().getTime(),
			dict: this.dict.index,
		};
	}

	/**
	 * Get buffer cache instance
	 * 
	 * @returns {BufferCache | null}
	 */
	getBuffer(): BufferCache | null {
		return this.buffer;
	}

	/**
	 * Get timers instance
	 * 
	 * @returns {Map<string, NodeJS.Timeout>}
	 */
	getTimers(): Map<string, NodeJS.Timeout> {
		return this.timers;
	}

	/**
	 * Stores content in the cache.
	 *
	 * @param {string} key - Unique identifier for the cache entry.
	 * @param {any} content - The content to store.
	 * @param {Partial<OptionsMetadata>} options - Storage options.
	 * @returns {Promise<void>}
	 * 
	 * @example
	 * await cache.set('user123', JSON.stringify({ name: 'John' }), { expire: 60000 });
	 */
	async set(key: string, content: any, options: Partial<OptionsMetadata> = {}): Promise<void> {
		try {
			const type = typeof content;

			if ('undefined' === type) {
				this.error(`Content is undefined at key: ${key}`);
				return;
			}

			let formattedContent = this.formatData(content, type);
			const size = Buffer.byteLength(formattedContent, 'utf8');
			if (this.config.maxSize > 0 && size > this.config.maxSize) {
				this.error(`Content size is over a ${key}`);
				return;
			}
			let fileName = crypto.createHash("md5").update(key).digest("hex");
			const filePath = `${fileName}.kncch`;
			if (options.compress || this.config.autoCompress) {
				formattedContent = await this.compress(formattedContent);
			}

			await fs.outputFile(path.resolve(this.config.folder, filePath), formattedContent)
				.then(async () => {
					this.log(`Saved Cache: ${key}`);
					const dt: DataMetadata = {
						path: filePath,
						size,
						type,
						createdAt: new Date().getTime(),
						updatedAt: new Date().getTime(),
						options: {
							...optionDefault,
							...options,
							compress: options.compress || this.config.autoCompress,
						}
					};
					this.metadata.data[key] = dt;

					if (options.search && options.search.length) {
						for (const value of options.search) {
							this.dict.addToDict(value, key);
						}
						this.metadata.dict = this.dict.index;
					}
					await this.flushMetadata();

					const expire = options.expire || this.config.expire;

					if (expire > 0) {
						this.deleteAfterTimeout(filePath, key, expire);
					} else {
						this.clearDeleteTimeout(key);
					}
				});
		} catch (err: any) {
			this.error(err.message);
		}
	}

	/**
	 * Checks if a key exists in the cache.
	 *
	 * @param {string} key - The key to check.
	 * @returns {boolean} - True if it exists, or false.
	 * 
	 * @example
	 * const exists = await cache.exist('user123');
	 * console.log(exists ? 'Key exists' : 'Key does not exist');
	 */
	exist(key: string): boolean {
		return this.readMetadata(key) ? true : false;
	}

	/**
	 * Retrieves cached content by key.
	 *
	 * @param {string} key - The key to retrieve content for.
	 * @returns {Promise<any>} - The cached content.
	 * 
	 * @example
	 * const data = await cache.get('user123');
	 * console.log(data);
	 */
	async get(key: string): Promise<any> {
		try {
			if (this.buffer && this.buffer.has(key)) {
				return this.buffer.get(key);
			}

			const metadata = this.readMetadata(key);

			if (!metadata) {
				this.error("Key does not exist");
				return undefined;
			}

			let result = await fs.readFile(path.resolve(this.config.folder, metadata.path), "utf8");

			if (metadata.options.compress) {
				result = await this.uncompress(result);
			}

			result = this.reformatData(result, metadata.type);

			if (this.buffer) {
				this.buffer.set(key, result);
			}

			return result;
		} catch (err: any) {
			this.error(err.message);
			return undefined;
		}
	}

	/**
	 * Deletes a cached entry by key.
	 *
	 * @param {string} key - The key to delete.
	 * @returns {Promise<void>}
	 * 
	 * @example
	 * await cache.del('user123');
	 * console.log('Cache deleted');
	 */
	async del(key: string): Promise<void> {
		try {
			const metadata = this.readMetadata(key);
			if (!metadata) {
				this.log(`Key ${key} not found for deletion.`);
				return;
			}

			// clear timeout if exist
			if (metadata.options.expire > 0) {
				this.clearDeleteTimeout(key);
			}

			await fs.remove(path.resolve(this.config.folder, metadata.path))
				.then(async () => {
					this.log(`Deleted Cache: ${key}`);
					await this.deleteMetadata(key);

					if (this.buffer) {
						this.buffer.del(key);
					}
				})
				.catch((err: Error) =>
					this.error(`Error deleting cache at ${metadata.path}: ${err.message}`)
				);
			await this.flushMetadata();
		} catch (err: any) {
			this.error(err.message);
		}
	}

	/**
	 * Searches cached entries based on keywords and logic.
	 *
	 * @param {string[]} keywords - Keywords to search for.
	 * @param {'AND' | 'OR'} logic - Logic to apply ("AND" or "OR").
	 * @returns {string[]} - Matching cache entries.
	 * 
	 * @example
	 * const results = await cache.search(['keyword1', 'keyword2'], 'AND');
	 * console.log(results);
	 */
	search(keywords: string[], logic: 'AND' | 'OR' = "AND"): string[] {
		return this.dict.search(keywords, logic);
	}

	/**
	 * Publish a message to a specific key (channel).
	 *
	 * @param {string} key - The key (channel) to publish the message to.
	 * @param {any} message - The message to publish.
	 */
	publish(key: string, message: any): void {
		this.eventEmitter.emit(key, message);
	}

	/**
	 * Subscribe to messages for a specific key (channel).
	 *
	 * @param {string} key - The key (channel) to subscribe to.
	 * @param {(message: any) => void} listener - The function to call when a message is received.
	 */
	subscribe(key: string, listener: (message: any) => void): void {
		this.eventEmitter.on(key, listener);
	}

	/**
	 * Initializes the cache folder.
	 */
	async setup(): Promise<void> {
		const folderPath = this.config.folder;
		await fs.ensureDir(folderPath)
			.then(() => {
				this.log(`Initialized folder: ${folderPath}`);
			})
			.catch((err: Error) => this.error(err.message));

		const metadataPath = path.resolve(folderPath, "metadata.json");
		let loadedMetadata: Partial<Metadata> = {};

		// check metadata exist
		if (fs.existsSync(metadataPath)) {
			// update config with metadata current
			loadedMetadata = await fs.readJSON(metadataPath);

			if (loadedMetadata.dict) {
				this.dict = new Dict(Object.fromEntries(Array.from(loadedMetadata.dict.entries()).map(([key, set]) => [key, Array.from(set)])));
			} else {
				this.dict = new Dict();
			}

			const currentDate = new Date().getTime();
			if (loadedMetadata.data) {
				for (const [key, value] of Object.entries(loadedMetadata.data)) {
					if (value.options.expire > 0) {
						const diff = value.options.expire - (currentDate - value.updatedAt);
						const expireT = diff > 0 ? diff : 1;
						this.deleteAfterTimeout(value.path, key, expireT);
					}
				}
			}

			if (loadedMetadata.peakDuration && loadedMetadata.peakDuration > 0) {
				this.buffer = new BufferCache(loadedMetadata.peakDuration);
			}
		} else {
			this.dict = new Dict();
		}

		this.metadata = {
			data: {},
			...loadedMetadata,
			createdAt: new Date().getTime(),
			autoCompress: this.config.autoCompress,
			peakDuration: this.config.peakDuration,
			path: folderPath,
			updatedAt: new Date().getTime(),
			dict: this.dict.index,
		};

		await fs.writeJSON(metadataPath, this.metadata);
	}

	/**
	 * Updates metadata for a specific key.
	 *
	 * @private
	 */
	private async updateMetadata(): Promise<void> {
		if (this.updateMetaTimer) {
			clearTimeout(this.updateMetaTimer);
		}

		this.updateMetaTimer = setTimeout(async () => {
			const metadataPath = path.resolve(this.config.folder, "metadata.json");

			await fs.writeJSON(metadataPath, this.metadata)
				.then(() => {
					this.log(`Updated Metadata`);
				})
				.catch((err: Error) => this.error(err.message));
		}, 500);
	}

	/**
	 * Flushes metadata to disk immediately.
	 *
	 * @private
	 */
	private async flushMetadata(): Promise<void> {
		const metadataPath = path.resolve(this.config.folder, "metadata.json");

		await fs.writeJSON(metadataPath, this.metadata)
			.then(() => {
				this.log(`Flushed Metadata`);
			})
			.catch((err: Error) => this.error(err.message));
	}

	/**
	 * Deletes metadata for a specific key.
	 *
	 * @param {string} key - The key to delete metadata for.
	 * @private
	 */
	private async deleteMetadata(key: string): Promise<void> {
		if (this.metadata.data[key]) {
			delete this.metadata.data[key];
			this.dict.removeValue(key);
			this.metadata.dict = this.dict.index;
			if (this.buffer) {
				this.buffer.del(key);
			}
		}
	}

	/**
	 * Reads metadata for a specific key.
	 *
	 * @param {string} key - The key to read metadata for.
	 * @returns {DataMetadata | null}
	 * @private
	 */
	private readMetadata(key: string): DataMetadata | null {
		return this.metadata.data[key] || null;
	}

	/**
	 * Deletes a file after a timeout.
	 *
	 * @param {string} filePath - The file path to delete.
	 * @param {string} key - The key to delete metadata for.
	 * @param {number} timeout - Timeout in milliseconds.
	 * @private
	 */
	private deleteAfterTimeout(filePath: string, key: string, timeout: number): void {
		// Check and clear existing timer if it exists
		if (this.timers.has(key)) {
			clearTimeout(this.timers.get(key)!);
			this.timers.delete(key);
		}

		// Set a new timer
		const timer = setTimeout(() => {
			this.worker.postMessage({
				folder: this.config.folder,
				filePath,
				key,
			});
		}, timeout);

		this.timers.set(key, timer);
	}


	/**
	 * Cancel timeout
	 * @param {string} key - Name file (cache key)
	 */
	private clearDeleteTimeout(key: string): void {
		if (this.timers.has(key)) {
			clearTimeout(this.timers.get(key)!);
			this.timers.delete(key);
			this.log(`Deleted expire key: ${key}`);
		}
	}

	/**
	 * Compresses raw data using Snappy.
	 *
	 * @param {string} rawData - The raw data to compress.
	 * @returns {Promise<string>} - The compressed data.
	 * @private
	 */
	private async compress(rawData: string): Promise<string> {
		return (await snappy.compress(rawData)).toString("base64");
	}

	/**
	 * Decompresses data using Snappy.
	 *
	 * @param {string} compressedData - The compressed data to decompress.
	 * @returns {Promise<string>} - The decompressed data.
	 * @private
	 */
	private async uncompress(compressedData: string): Promise<string> {
		const compressedBuffer = Buffer.from(compressedData, "base64");
		return (await snappy.uncompress(compressedBuffer, { asBuffer: false })).toString();
	}

	/**
	 * Logs messages if logging is enabled.
	 *
	 * @param {string} message - The message to log.
	 * @private
	 */
	private log(message: string): void {
		if (this.config.log) {
			this.config.logHandle(message);
		}
	}

	/**
	 * Errors messages
	 *
	 * @param {string} message - The message to log.
	 * @private
	 */
	private error(message: string): void {
		this.config.errorHandle(message);
	}

	/**
	 * Format message
	 * 
	 * @param {any} data 
	 * @param {string} type - "Number" | "String" | "Object" 
	 * 
	 * @returns {string}
	 */
	private formatData(data: any, type: string = "string"): string {
		switch (type) {
			case "object":
				return JSON.stringify(data);
			default:
				return String(data);
		}
	}


	/**
	 * Format message
	 * 
	 * @param {string} formattedData 
	 * @param {string} type - "number" | "string" | "object" 
	 * 
	 * @returns {any}
	 */
	private reformatData(formattedData: string, type: string = "string"): any {
		switch (type) {
			case "object":
				return JSON.parse(formattedData);
			case "number":
				return Number(formattedData);
			default:
				return String(formattedData);
		}
	}
}

export default CacheFile;
