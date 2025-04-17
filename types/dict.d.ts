export = Dict;
/**
 * @module Dict
 */
/**
 * A class that implements a dictionary (associative array) for managing keywords and their associated values.
 */
declare class Dict {
    /**
     * Create a new Dict instance.
     *
     * @param {Object<string, Array<string>>} [index={}] - Initial index for the dictionary.
     */
    constructor(index?: {
        [x: string]: string[];
    });
    index: {
        [x: string]: string[];
    };
    /**
     * Add a value to a keyword in the dictionary.
     * If the keyword already exists, the value is added to the existing list.
     *
     * @param {String} keyword - The keyword to associate the value with.
     * @param {String} value - The value to add under the keyword.
     */
    addToDict(keyword: string, value: string): void;
    /**
     * Search keys based on multiple keywords with AND/OR logic.
     *
     * @param {Array<String>} keywords - List of keywords to search for.
     * @param {String} logic - 'AND' or 'OR'. Defaults to 'OR'.
     *    - 'AND' returns only keys that match all keywords.
     *    - 'OR' returns keys that match any of the keywords.
     * @returns {Array<string>} - List of keys based on the logic.
     */
    search(keywords: Array<string>, logic?: string): Array<string>;
    /**
     * Remove a value from all keywords in the dictionary.
     * If a keyword has no values left after removal, delete the keyword.
     *
     * @param {String} value - The value to remove from the dictionary.
     * @returns {void}
     */
    removeValue(value: string): void;
}
