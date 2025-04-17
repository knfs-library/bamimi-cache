export = CacheFile;
/**
 * CacheFile class for handling file-based caching.
 */
declare class CacheFile {
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
    constructor(config?: {
        folder?: string;
        expire?: number;
        autoCompress?: boolean;
        log?: boolean;
    });
    dict: Dict;
    /**
     * Get buffer cache instance
     *
     * @returns {BufferCache}
     */
    getBuffer(): BufferCache;
    /**
     * Get timers instance
     *
     * @returns {Map<string, NodeJS.Timeout>}
     */
    getTimers(): Map<string, NodeJS.Timeout>;
    /**
     * Stores content in the cache.
     *
     * @param {String} key - Unique identifier for the cache entry.
     * @param {String} content - The content to store.
     * @param {Object} options - Storage options.
     * @param {boolean} [options.compress] - Whether to compress the content.
     * @param {number} [options.expire] - Expiration time in milliseconds.
     * @param {Array<string>} [options.search] - Keywords for searching
     * @returns {Promise<void>}
     *
     * @example
     * await cache.set('user123', JSON.stringify({ name: 'John' }), { expire: 60000 });
     */
    set(key: string, content: string, options?: {
        compress?: boolean;
        expire?: number;
        search?: Array<string>;
    }): Promise<void>;
    /**
     * Checks if a key exists in the cache.
     *
     * @param {String} key - The key to check.
     * @returns {boolean} - True if it exists, or false.
     *
     * @example
     * const exists = await cache.exist('user123');
     * console.log(exists ? 'Key exists' : 'Key does not exist');
     */
    exist(key: string): boolean;
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
    get(key: string): Promise<string>;
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
    del(key: string): Promise<void>;
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
    search(keywords: Array<string>, logic?: string): Array<string>;
    /**
     * Publish a message to a specific key (channel).
     *
     * @param {String} key - The key (channel) to publish the message to.
     * @param {String} message - The message to publish.
     */
    publish(key: string, message: string): void;
    /**
     * Subscribe to messages for a specific key (channel).
     *
     * @param {String} key - The key (channel) to subscribe to.
     * @param {Function} listener - The function to call when a message is received.
     */
    subscribe(key: string, listener: Function): void;
    /**
     * Initializes the cache folder.
     */
    setup(): Promise<void>;
    #private;
}
declare namespace CacheFile {
    export { ConfigType, OptionsMetadata, DataMetadata };
}
import Dict = require("./dict");
import BufferCache = require("./buffer");
/**
 * Define Types
 */
type ConfigType = {
    /**
     * - The folder path to store cached files.
     */
    folder: string;
    /**
     * - Default expiration time in milliseconds.
     */
    expire: number;
    /**
     * - Automatically compress cached data.
     */
    autoCompress: boolean;
    /**
     * - Enable or disable logging.
     */
    log: boolean;
    /**
     * - Duration for peak usage.
     */
    peakDuration: number;
    /**
     * - Maximum size for cache.
     */
    maxSize: number;
    /**
     * - Function to handle log messages.
     */
    logHandle: (arg0: string) => void;
    /**
     * - Function to handle error messages.
     */
    errorHandle: (arg0: string) => void;
};
type OptionsMetadata = {
    /**
     * - Expiration time in milliseconds.
     */
    expire: number;
    /**
     * - Whether to compress the content.
     */
    compress: boolean;
    /**
     * - Keywords for searching.
     */
    search: Array<string>;
};
type DataMetadata = {
    /**
     * - Timestamp of when the cache entry was created.
     */
    createdAt: number;
    /**
     * - Timestamp of when the cache entry was last updated.
     */
    updatedAt: number;
    /**
     * - The file path to the cached data.
     */
    path: string;
    /**
     * - Metadata options.
     */
    options: OptionsMetadata;
    /**
     * - Data type
     */
    type: string;
    /**
     * - File size
     */
    size: number;
};
