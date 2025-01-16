const fs = require("fs-extra");
const CacheFile = require("./../../lib/cjs");
const path = require("path");
const os = require("os");

jest.mock('snappy', () => ({
	compress: jest.fn().mockResolvedValue('mocked compressed data'),
	uncompress: jest.fn().mockResolvedValue('mocked uncompressed data'),
}));


describe("CacheFile (Real Components)", () => {
	let cacheFile;
	let tempFolder;

	beforeEach(async () => {
		// Tạo thư mục tạm
		tempFolder = path.join(os.tmpdir(), "cache-test");
		await fs.ensureDir(tempFolder);

		// Tạo instance của CacheFile
		cacheFile = new CacheFile({
			folder: tempFolder,
			expire: 60000, // 1 phút
			autoCompress: false,
			log: false,
		});

		await cacheFile.setup()
	});

	afterEach(async () => {
		// Xóa toàn bộ thư mục tạm
		jest.clearAllMocks();
		jest.restoreAllMocks();
		await fs.remove(tempFolder);
	});

	describe("set", () => {
		it("should save cache with default options", async () => {
			const key = "testKey";
			const content = "some content";

			await cacheFile.set(key, content);

			// Kiểm tra file có được ghi hay không
			const files = await fs.readdir(tempFolder);
			expect(files.length).toBeGreaterThan(0);
		});
	});

	describe("get", () => {
		it("should retrieve the cached content", async () => {
			const key = "testKey";
			const content = "some content";

			// Lưu cache
			await cacheFile.set(key, content);

			// Lấy lại nội dung
			const result = await cacheFile.get(key);

			expect(result).toBe(content);
		});
	});

	describe("del", () => {
		it("should delete cache and metadata", async () => {
			const key = "testKey";
			const content = "some content";

			// Lưu cache
			await cacheFile.set(key, content);

			// Xóa cache
			await cacheFile.del(key);

			// Đảm bảo file đã bị xóa

			const exist = await cacheFile.exist(key)
			
			expect(exist).toBeNull()
		});
	});
});
