import Dict from './../../src/dict';

describe('Dict Class', () => {
	let dict: Dict;

	beforeEach(() => {
		dict = new Dict();
	});

	describe('addToDict', () => {
		it('should add a value to a keyword', () => {
			dict.addToDict('abc', 'value1');
			expect(dict.index.get('abc')).toEqual(new Set(['value1']));
		});

		it('should add multiple values to the same keyword', () => {
			dict.addToDict('abc', 'value1');
			dict.addToDict('abc', 'value2');
			expect(dict.index.get('abc')).toEqual(new Set(['value1', 'value2']));
		});
	});

	describe('search', () => {
		beforeEach(() => {
			dict.addToDict('abc', 'value1');
			dict.addToDict('abc', 'value2');
			dict.addToDict('bcd', 'value2');
			dict.addToDict('bcd', 'value3');
		});

		it('should return an empty array if no keywords are provided', () => {
			expect(dict.search([])).toEqual([]);
		});

		it('should return values for a single keyword', () => {
			expect(dict.search(['abc'])).toEqual(['value1', 'value2']);
		});

		it('should return values for multiple keywords with OR logic', () => {
			expect(dict.search(['abc', 'bcd'])).toEqual(['value1', 'value2', 'value3']);
		});

		it('should return values for multiple keywords with AND logic', () => {
			expect(dict.search(['abc', 'bcd'], 'AND')).toEqual(['value2']);
		});
	});

	describe('removeValue', () => {
		beforeEach(() => {
			dict.addToDict('abc', 'value1');
			dict.addToDict('abc', 'value2');
			dict.addToDict('bcd', 'value1');
		});

		it('should remove a value from a keyword', () => {
			dict.removeValue('value1');
			expect(dict.index.get('abc')).toEqual(new Set(['value2']));
			expect(dict.index.has('bcd')).toBe(false);
		});

		it('should delete a keyword if no values remain', () => {
			dict.removeValue('value1');
			dict.removeValue('value2');
			expect(dict.index.has('abc')).toBe(false);
			expect(dict.index.has('bcd')).toBe(false);
		});
	});
});
