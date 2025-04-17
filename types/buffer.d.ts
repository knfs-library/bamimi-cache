export = BufferCache;
/**
 * @module BufferCache
 */
/**
 * A lightweight buffer class with expiration and automatic cleanup.
 * Stores key-value pairs with optional expiration and last-access tracking.
 */
declare class BufferCache {
    /**
     * Initializes a new Buffer instance.
     *
     * @param {number} [exp=1000] - Expiration time in milliseconds for each entry. Defaults to 1000ms.
     */
    constructor(exp?: number);
    /**
     * Internal Map to store buffer entries.
     * @type {Map<string, {value: any, lastAccessed: number}>}
     */
    storage: Map<string, {
        value: any;
        lastAccessed: number;
    }>;
    /**
     * Expiration time for each entry in milliseconds.
     * @type {number}
     */
    expirationTime: number;
    /**
     * Interval ID for automatic cleanup.
     * @type {NodeJS.Timer}
     */
    cleanupInterval: NodeJS.Timer;
    /**
     * Adds a key-value pair to the buffer.
     *
     * @param {string} key - The key to identify the stored value.
     * @param {*} value - The value to store in the buffer.
     */
    set(key: string, value: any): void;
    /**
     * Retrieves the value associated with the given key.
     * Updates the last accessed time for the key.
     *
     * @param {string} key - The key to retrieve the value for.
     * @returns {*} - The value associated with the key, or `undefined` if the key does not exist.
     */
    get(key: string): any;
    /**
     * Checks if a key exists in the buffer.
     *
     * @param {string} key - The key to check for existence.
     * @returns {boolean} - `true` if the key exists, otherwise `false`.
     */
    has(key: string): boolean;
    /**
     * Delete key in buffer
     *
     * @param {string} key - The key to check for existence.
     * @returns {boolean} - `true` if the key exists, otherwise `false`.
     */
    del(key: string): boolean;
    /**
     * Removes expired entries from the buffer.
     * An entry is considered expired if its last accessed time exceeds the expiration time.
     */
    cleanup(): void;
    /**
     * Stops the automatic cleanup process by clearing the interval.
     */
    stopCleanup(): void;
}
