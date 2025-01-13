import path from "path";
import fs from "fs-extra";
import snappy from "snappy";
import crypto from "crypto";
import Dict from "./dict.js";

/**
 * Define Types
 *
 * @typedef {{expire: number, compress: boolean, search: Array<string>}} OptionsMetadata
 * @typedef {{createdAt: number, updatedAt: number, path: string, options: OptionsMetadata}} DataMetadata
 */

const configDefault = {
	folder: path.join(process.cwd(), "cache"),
	expire: 0,
	autoCompress: false,
	log: false,
};

const optionDefault = {
	expire: 0,
	compress: false,
};

export default class CacheFile {
	constructor(config = null) {
		this.config = config || configDefault;
		this.timers = new Map();

		this.#initFolder(this.config.folder);
	}

	async set(key, content, options = { compress: false, expire: 0, search: [] }) {
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

		const rawContent = await fs.readFile(path.resolve(this.config.folder, metadata.path), "utf8");

		if (!metadata.options.compress) {
			return rawContent;
		}

		return await this.#uncompress(rawContent);
	}

	async del(key) {
		const metadata = await this.#readMetadata(key);
		if (0 < metadata.options.expire) {
			this.#clearDeleteTimeout(key);
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

	async search(keywords, logic = "AND") {
		return this.dict.search(keywords, logic);
	}

	#initFolder(folderPath) {
		fs.ensureDir(folderPath)
			.then(() => {
				this.#log(`Initialized folder: ${folderPath}`);
			})
			.catch((err) => console.error(err))
			.finally(async () => {
				const metadataPath = path.resolve(folderPath, "metadata.json");
				let metadata = {};
				if (fs.existsSync(metadataPath)) {
					metadata = await fs.readJSON(metadataPath);

					if (metadata.dict) {
						this.dict = new Dict(metadata.dict);
					} else {
						this.dict = new Dict();
					}

					for (const [key, value] of Object.entries(metadata.data)) {
						if (value.options.expire > 0) {
							this.#deleteAfterTimeout(value.path, key, value.options.expire);
						}
					}
				} else {
					this.dict = new Dict();
				}

				metadata = {
					createdAt: new Date().getTime(),
					autoCompress: this.config.autoCompress,
					data: {},
					...metadata,
					path: folderPath,
					updatedAt: new Date().getTime(),
					dict: this.dict.index,
				};
				fs.writeJSON(metadataPath, metadata);
			});
	}

	async #updateMetadata(key, filePath, options) {
		const metadataPath = path.resolve(this.config.folder, "metadata.json");
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
		const metadataPath = path.resolve(this.config.folder, "metadata.json");

		const metadata = await fs.readJSON(metadataPath);
		if (metadata.data[key]) {
			delete metadata.data[key];
			this.dict.removeValue(key);
			metadata.dict = this.dict.index;
		}
		await fs.writeJSON(metadataPath, metadata)
			.then(() => {
				this.#log(`Updated Metadata`);
			})
			.catch((err) => console.error(err));
	}

	async #readMetadata(key) {
		const metadataPath = path.resolve(this.config.folder, "metadata.json");
		const metadata = await fs.readJSON(metadataPath);
		return metadata.data[key] || null;
	}

	#deleteAfterTimeout(filePath, key, timeout) {
		if (this.timers.has(key)) {
			clearTimeout(this.timers.get(key));
			this.timers.delete(key);
		}

		const timer = setTimeout(async () => {
			try {
				await fs.remove(path.resolve(this.config.folder, filePath));
				this.#log(`Deleted key: ${key}`);
				this.timers.delete(key);
				await this.#deleteMetadata(key);
			} catch (err) {
				console.error(`Error deleting file ${filePath}:`, err);
			}
		}, timeout);

		this.timers.set(key, timer);
	}

	#clearDeleteTimeout(key) {
		if (this.timers.has(key)) {
			clearTimeout(this.timers.get(key));
			this.timers.delete(key);
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
		if (this.config.log) {
			console.log(`BAMIMI CACHE| ${message}`);
		}
	}
}
