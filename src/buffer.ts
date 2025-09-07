/**
 * @module BufferCache
 */

interface BufferEntry {
	value: any;
	lastAccessed: number;
}

/**
 * A lightweight buffer class with expiration and automatic cleanup.
 * Stores key-value pairs with optional expiration and last-access tracking.
 */
class BufferCache {
	private storage: Map<string, BufferEntry>;
	private expirationTime: number;
	private cleanupInterval: NodeJS.Timeout;

	/**
	 * Initializes a new Buffer instance.
	 * 
	 * @param {number} [exp=1000] - Expiration time in milliseconds for each entry. Defaults to 1000ms.
	 */
	constructor(exp: number = 1000) {
		this.storage = new Map<string, BufferEntry>();
		this.expirationTime = exp;
		this.cleanupInterval = setInterval(() => {
			this.cleanup();
		}, exp * 2);
	}

	/**
	 * Adds a key-value pair to the buffer.
	 * 
	 * @param {string} key - The key to identify the stored value.
	 * @param {any} value - The value to store in the buffer.
	 */
	set(key: string, value: any): void {
		const now = Date.now();
		this.storage.set(key, { value, lastAccessed: now });
	}

	/**
	 * Retrieves the value associated with the given key.
	 * Updates the last accessed time for the key.
	 * 
	 * @param {string} key - The key to retrieve the value for.
	 * @returns {any | undefined} - The value associated with the key, or `undefined` if the key does not exist.
	 */
	get(key: string): any | undefined {
		const entry = this.storage.get(key);

		if (entry) {
			entry.lastAccessed = Date.now();
			return entry.value;
		}

		return undefined;
	}

	/**
	 * Checks if a key exists in the buffer.
	 * 
	 * @param {string} key - The key to check for existence.
	 * @returns {boolean} - `true` if the key exists, otherwise `false`.
	 */
	has(key: string): boolean {
		return this.storage.has(key);
	}

	/**
	 * Delete key in buffer
	 * 
	 * @param {string} key - The key to check for existence.
	 * @returns {boolean} - `true` if the key exists, otherwise `false`.
	 */
	del(key: string): boolean {
		return this.storage.delete(key);
	}

	/**
	 * Removes expired entries from the buffer.
	 * An entry is considered expired if its last accessed time exceeds the expiration time.
	 */
	cleanup(): void {
		try {
			const now = Date.now();
			for (const [key, entry] of this.storage) {
				if (now - entry.lastAccessed > this.expirationTime) {
					this.storage.delete(key);
				}
			}
		} catch (error) {
			console.error("Error during cleanup:", error);
		}
	}

	/**
	 * Stops the automatic cleanup process by clearing the interval.
	 */
	stopCleanup(): void {
		clearInterval(this.cleanupInterval);
	}
}

export default BufferCache;
