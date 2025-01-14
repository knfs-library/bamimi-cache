'use strict';

/**
 * A lightweight buffer class with expiration and automatic cleanup.
 * Stores key-value pairs with optional expiration and last-access tracking.
 */
class BufferCache {
	/**
	 * Initializes a new Buffer instance.
	 * 
	 * @param {number} [exp=1000] - Expiration time in milliseconds for each entry. Defaults to 1000ms.
	 */
	constructor(exp = 1000) {
		/**
		 * Internal Map to store buffer entries.
		 * @type {Map<string, {value: any, lastAccessed: number}>}
		 */
		this.storage = new Map();

		/**
		 * Expiration time for each entry in milliseconds.
		 * @type {number}
		 */
		this.expirationTime = exp;

		/**
		 * Interval ID for automatic cleanup.
		 * @type {NodeJS.Timer}
		 */
		this.cleanupInterval = setInterval(() => {
			this.cleanup();
		}, exp);
	}

	/**
	 * Adds a key-value pair to the buffer.
	 * 
	 * @param {string} key - The key to identify the stored value.
	 * @param {*} value - The value to store in the buffer.
	 */
	set(key, value) {
		const now = Date.now();
		this.storage.set(key, { value, lastAccessed: now });
	}

	/**
	 * Retrieves the value associated with the given key.
	 * Updates the last accessed time for the key.
	 * 
	 * @param {string} key - The key to retrieve the value for.
	 * @returns {*} - The value associated with the key, or `undefined` if the key does not exist.
	 */
	get(key) {
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
	has(key) {
		return this.storage.has(key);
	}

	/**
	 * Delete key in buffer
	 * 
	 * @param {string} key - The key to check for existence.
	 * @returns {boolean} - `true` if the key exists, otherwise `false`.
	 */
	del(key) {
		return this.storage.delete(key);
	}

	/**
	 * Removes expired entries from the buffer.
	 * An entry is considered expired if its last accessed time exceeds the expiration time.
	 */
	cleanup() {
		const now = Date.now();
		for (const [key, entry] of this.storage) {
			if (now - entry.lastAccessed > this.expirationTime) {
				this.storage.delete(key);
			}
		}
	}

	/**
	 * Stops the automatic cleanup process by clearing the interval.
	 */
	stopCleanup() {
		clearInterval(this.cleanupInterval);
	}
}

module.exports = BufferCache;
