import BufferCache from './../../src/buffer';

describe('BufferCache class', () => {
	let buffer: BufferCache;

	beforeEach(() => {
		jest.useFakeTimers();
		buffer = new BufferCache(1000);
	});

	afterEach(() => {
		buffer.stopCleanup();
		jest.useRealTimers();
	});

	test('should store and retrieve a value', () => {
		buffer.set('key1', 'value1');
		expect(buffer.get('key1')).toBe('value1');
	});

	test('should return undefined for non-existent keys', () => {
		expect(buffer.get('nonExistentKey')).toBeUndefined();
	});

	test('should update lastAccessed on get', () => {
		const now = Date.now();
		jest.spyOn(global.Date, 'now').mockReturnValue(now);

		buffer.set('key1', 'value1');
		jest.spyOn(global.Date, 'now').mockReturnValue(now + 500);
		buffer.get('key1');

		// @ts-ignore - Accessing private property for testing purposes
		expect(buffer.storage.get('key1').lastAccessed).toBe(now + 500);
	});

	test('should delete expired entries during cleanup', () => {
		buffer.set('key1', 'value1');
		buffer.set('key2', 'value2');

		jest.advanceTimersByTime(1500);
		buffer.cleanup();

		expect(buffer.get('key1')).toBeUndefined();
		expect(buffer.get('key2')).toBeUndefined();
	});

	test('should not delete entries that are recently accessed', () => {
		buffer.set('key1', 'value1');

		jest.advanceTimersByTime(500);
		buffer.get('key1');

		jest.advanceTimersByTime(500);
		buffer.cleanup();

		expect(buffer.get('key1')).toBe('value1');
	});

	test('should check if key exists', () => {
		buffer.set('key1', 'value1');
		expect(buffer.has('key1')).toBe(true);
		expect(buffer.has('nonExistentKey')).toBe(false);
	});

	test('should stop cleanup interval when stopCleanup is called', () => {
		const spy = jest.spyOn(global, 'clearInterval');
		buffer.stopCleanup();
		// @ts-ignore - Accessing private property for testing purposes
		expect(spy).toHaveBeenCalledWith(buffer.cleanupInterval);
	});
});
