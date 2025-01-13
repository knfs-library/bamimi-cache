const assert = require('assert');
const Dict = require('./../../lib/cjs/dict');

describe('Dict Class', function () {
	let dict;

	beforeEach(function () {
		dict = new Dict();
	});

	describe('addToDict', function () {
		it('should add a value to a keyword', function () {
			dict.addToDict('abc', 'value1');
			assert.deepStrictEqual(dict.index['abc'], ['value1']);
		});

		it('should add multiple values to the same keyword', function () {
			dict.addToDict('abc', 'value1');
			dict.addToDict('abc', 'value2');
			assert.deepStrictEqual(dict.index['abc'], ['value1', 'value2']);
		});
	});

	describe('search', function () {
		beforeEach(function () {
			dict.addToDict('abc', 'value1');
			dict.addToDict('abc', 'value2');
			dict.addToDict('bcd', 'value2');
			dict.addToDict('bcd', 'value3');
		});

		it('should return an empty array if no keywords are provided', function () {
			assert.deepStrictEqual(dict.search([]), []);
		});

		it('should return values for a single keyword', function () {
			assert.deepStrictEqual(dict.search(['abc']), ['value1', 'value2']);
		});

		it('should return values for multiple keywords with OR logic', function () {
			assert.deepStrictEqual(dict.search(['abc', 'bcd']), ['value1', 'value2', 'value3']);
		});

		it('should return values for multiple keywords with AND logic', function () {
			assert.deepStrictEqual(dict.search(['abc', 'bcd'], 'AND'), ['value2']);
		});
	});

	describe('removeValue', function () {
		beforeEach(function () {
			dict.addToDict('abc', 'value1');
			dict.addToDict('abc', 'value2');
			dict.addToDict('bcd', 'value1');
		});

		it('should remove a value from a keyword', function () {
			dict.removeValue('value1');
			assert.deepStrictEqual(dict.index['abc'], ['value2']);
			assert.deepStrictEqual(dict.index['bcd'], undefined);
		});

		it('should delete a keyword if no values remain', function () {
			dict.removeValue('value1');
			dict.removeValue('value2');
			assert.strictEqual(dict.index['abc'], undefined);
			assert.strictEqual(dict.index['bcd'], undefined);
		});
	});
});
