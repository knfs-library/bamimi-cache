const fs = require("fs-extra");
const CacheFile = require("./../../lib/cjs");

jest.mock("fs-extra", () => ({
	ensureDir: jest.fn().mockResolvedValue(undefined),
	outputFile: jest.fn().mockResolvedValue(undefined),
	readFile: jest.fn().mockResolvedValue("cached data"),
	remove: jest.fn().mockResolvedValue(undefined),
	writeJSON: jest.fn().mockResolvedValue(undefined),
	existsSync: jest.fn().mockResolvedValue(false)
}));

jest.mock('snappy', () => ({
	compress: jest.fn().mockResolvedValue('mocked compressed data'),
	uncompress: jest.fn().mockResolvedValue('mocked uncompressed data'),
}));

describe("CacheFile", () => {
	let cacheFile;

	beforeEach(() => {
		cacheFile = new CacheFile({
			folder: "/tmp/cache",
			expire: 60000,  // 1 minute
			autoCompress: false,
			log: false,
		});

	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe("set", () => {
		it("should save cache with default options", async () => {
			const key = "testKey";
			const content = "some content";

			await cacheFile.set(key, content);

			expect(fs.outputFile).toHaveBeenCalled();
		});

		it("should handle expiration correctly", async () => {
			const key = "testKey";
			const content = "some content";
			const expire = 5000;  // 5 seconds

			const setSpy = jest.spyOn(cacheFile, "set");
			await cacheFile.set(key, content, { expire });

			expect(setSpy).toHaveBeenCalled();
			setTimeout(() => {
				expect(fs.remove).toHaveBeenCalled();
			}, expire);
		});
	});

	describe("get", () => {
		it("should retrieve the cached content", async () => {
			const key = "testKey";
			const content = "some content";
			const filePath = "testFile.kncch";

			// Mock metadata
			const metadata = {
				path: filePath,
				options: { compress: false },
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};

			fs.readFile.mockResolvedValue(content);

			const result = await cacheFile.get(key);

			expect(result).toBe(content);
			expect(fs.readFile).toHaveBeenCalled();
		});
	});

	describe("del", () => {
		it("should delete cache and metadata", async () => {
			const key = "testKey";
			const metadata = {
				path: "testFile.kncch",
				options: { expire: 0 },
			};

			await cacheFile.del(key);

			expect(fs.remove).toHaveBeenCalled();
			expect(fs.writeJSON).toHaveBeenCalled();
		});
	});

	describe("search", () => {
		it("should return results for given keywords", async () => {
			const keywords = ["test", "search"];
			const logic = "AND";

			const searchSpy = jest.spyOn(cacheFile.dict, "search").mockResolvedValue(["result1", "result2"]);
			const results = await cacheFile.search(keywords, logic);

			expect(searchSpy).toHaveBeenCalledWith(keywords, logic);
			expect(results).toEqual(["result1", "result2"]);
		});
	});
});
