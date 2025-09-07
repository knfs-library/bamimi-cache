/**
 * @module Dict
 */

/**
 * A class that implements a dictionary (associative array) for managing keywords and their associated values.
 */
class Dict {
	public index: Map<string, Set<string>>;

	/**
	 * Create a new Dict instance.
	 *
	 * @param {Record<string, string[]>} [initialIndex={}] - Initial index for the dictionary.
	 */
	constructor(initialIndex: Record<string, string[]> = {}) {
		this.index = new Map(Object.entries(initialIndex).map(([key, value]) => [key, new Set(value)]));
	}

	/**
	 * Add a value to a keyword in the dictionary.
	 * If the keyword already exists, the value is added to the existing list.
	 * 
	 * @param {string} keyword - The keyword to associate the value with.
	 * @param {string} value - The value to add under the keyword.
	 */
	addToDict(keyword: string, value: string): void {
		try {
			if (this.index.has(keyword)) {
				this.index.get(keyword)!.add(value);
			} else {
				this.index.set(keyword, new Set([value]));
			}
		} catch (error) {
			console.error("Error in addToDict:", error);
		}
	}

	/**
	 * Search keys based on multiple keywords with AND/OR logic.
	 * 
	 * @param {string[]} keywords - List of keywords to search for.
	 * @param {'AND' | 'OR'} logic - 'AND' or 'OR'. Defaults to 'OR'. 
	 *    - 'AND' returns only keys that match all keywords.
	 *    - 'OR' returns keys that match any of the keywords.
	 * @returns {string[]} - List of keys based on the logic.
	 */
	search(keywords: string[], logic: 'AND' | 'OR' = "OR"): string[] {
		try {
			if (0 === keywords.length) {
				return [];
			}

			const keySets = keywords.map(keyword => this.index.get(keyword) || new Set<string>());

			if ("AND" === logic) {
				if (keySets.length === 0) return [];
				const intersection = keySets.reduce((acc: Set<string>, set: Set<string>) => {
					const result = new Set<string>();
					for (const val of acc) {
						if (set.has(val)) {
							result.add(val);
						}
					}
					return result;
				}, keySets[0]);
				return Array.from(intersection);
			} else {
				const union = keySets.reduce((acc: Set<string>, set: Set<string>) => {
					for (const val of set) {
						acc.add(val);
					}
					return acc;
				}, new Set<string>());
				return Array.from(union);
			}
		} catch (error) {
			console.error("Error in search:", error);
			return [];
		}
	}

	/**
	 * Remove a value from all keywords in the dictionary.
	 * If a keyword has no values left after removal, delete the keyword.
	 * 
	 * @param {string} value - The value to remove from the dictionary.
	 * @returns {void}
	 */
	removeValue(value: string): void {
		try {
			for (const [keyword, values] of this.index) {
				if (values.has(value)) {
					values.delete(value);
					if (values.size === 0) {
						this.index.delete(keyword);
					}
				}
			}
		} catch (error) {
			console.error("Error in removeValue:", error);
		}
	}
}

export default Dict;
