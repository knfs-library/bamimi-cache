export default class Dict {
	constructor(index = {}) {
		this.index = index;
	}

	/**
	 * Add a value to a keyword in the dictionary.
	 * If the keyword already exists, the value is added to the existing list.
	 * 
	 * @param {String} keyword - The keyword to associate the value with.
	 * @param {String} value - The value to add under the keyword.
	 */
	addToDict(keyword, value) {
		if (this.index[keyword]) {
			const set = new Set([...this.index[keyword]]);
			set.add(value);
			this.index[keyword] = Array.from(set);
		} else {
			this.index[keyword] = [value];
		}
	}

	/**
	 * Search keys based on multiple keywords with AND/OR logic.
	 * 
	 * @param {Array<String>} keywords - List of keywords to search for.
	 * @param {String} logic - 'AND' or 'OR'. Defaults to 'OR'. 
	 *    - 'AND' returns only keys that match all keywords.
	 *    - 'OR' returns keys that match any of the keywords.
	 * @returns {Array} - List of keys based on the logic.
	 */
	search(keywords, logic = "OR") {
		if (keywords.length === 0) {
			return [];
		}
		if (keywords.length === 1) {
			return this.index[keywords[0]] || [];
		}
		const keySets = keywords.map((keyword) => new Set(this.index[keyword] || []));
		if (logic === "AND") {
			return [...keySets.reduce((a, b) => new Set([...a].filter((key) => b.has(key))))];
		} else {
			return [...keySets.reduce((a, b) => new Set([...a, ...b]))];
		}
	}

	/**
	 * Remove a value from all keywords in the dictionary.
	 * If a keyword has no values left after removal, delete the keyword.
	 * 
	 * @param {String} value - The value to remove from the dictionary.
	 * @returns {void}
	 */
	removeValue(value) {
		for (const keyword in this.index) {
			const values = this.index[keyword];
			const updatedValues = values.filter((v) => v !== value);

			// Update the dictionary
			if (updatedValues.length > 0) {
				this.index[keyword] = updatedValues;
			} else {
				// If no values left for this keyword, delete the keyword
				delete this.index[keyword];
			}
		}
	}
}
