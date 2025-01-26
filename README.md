<p align="center">
  <br>
	<a href="https://github.com/knfs-library/bamimi-cache/actions/workflows/unit-test.yml" alt="github">
	<img src="https://github.com/knfs-library/bamimi-cache/actions/workflows/unit-test.yml/badge.svg" alt="Github Actions" />
	</a>
</p>

# About **BAMIMI Cache**

**BAMIMI Cache** is a lightweight, file-based caching library designed for Node.js applications. It provides flexible caching with optional compression, expiration handling, and keyword search capabilities. The library is easy to use and integrates seamlessly into modern applications.

---

## Installation

Install BAMIMI Cache via **npm** or **yarn**:

```bash
npm i @knfs-tech/bamimi-cache
# OR
yarn add @knfs-tech/bamimi-cache
```

---

## Features

- **File-based Caching**: Store data directly on the file system for fast and efficient access.
- **Compression**: Reduce file sizes with Snappy compression.
- **Expiration Handling**: Automatically delete cached entries after a specified duration.
- **Keyword Search**: Search through cached entries using keywords with `AND`/`OR` logic.
- **Logging**: Enable optional logging for debugging and monitoring.
- **Flexible Configuration**: Set up default settings for expiration, compression, and cache directory.

---

## Basic Usage

### Example

```javascript
const CacheFile = require('@knfs-tech/bamimi-cache');

// Initialize the cache system
const cache = new CacheFile({
  folder: './my-cache', // Custom cache folder
  autoCompress: true,   // Automatically compress data
  log: true,            // Enable logging
});
cache.setup()

// Store data in the cache
await cache.set('user:123', JSON.stringify({ name: 'John Doe' }), { expire: 60000 });

// Retrieve data from the cache
const userData = await cache.get('user:123');
console.log(JSON.parse(userData));

// Check if a key exists
const exists = await cache.exist('user:123');
console.log(exists ? 'Key exists' : 'Key does not exist');

// Delete a cache entry
await cache.del('user:123');
```

---

## API Reference

### **Constructor**

#### `new CacheFile(config)`
Creates a new instance of BAMIMI Cache.

| Parameter             | Type    | Default                  | Description                                 | Support Version     |
| --------------------- | ------- | ------------------------ | ------------------------------------------- |-------------|
| `config.folder`       | String  | `projectPath + /cache` | Directory to store cached files.              | >= 1.0.2
| `config.expire`       | Number  | `0`                      | Default expiration time in milliseconds, (0 is not expire)    |   >= 1.0.2  |
| `config.autoCompress` | Boolean | `false`                  | Enable auto-compression for cached content. | >= 1.0.2     |
| `config.log`          | Boolean | `false`                  | Enable or disable logging.                  | >= 1.0.2     |   
| `config.peakDuration`  | Number  | `3000`                   | Allows peak time to use cache to store the results returned when getting, to increase query speed. If peakDuration is 0, it means it is not used.  | >= 1.1.3     |
| `config.maxSize`  | Number  | `0`                   | Default max size of cache content in bytes, (0 is not verify).  | >= 1.2.9     |
| `config.logHandle`  | Number  | use `console.log`                   | Function handle log  | >= 1.3.0 (Latest)     |
| `config.errorHandle`  | Number  | use `throw new Error`                  | Function handle error.  | >= 1.3.0     |

---

### **Methods**

#### **`setup()`**
Initialize configuration files

#### **`set(key, content, options)`**
Stores data in the cache.

| Parameter          | Type          | Description                               |
| ------------------ | ------------- | ----------------------------------------- |
| `key`              | String        | Unique identifier for the cache entry.    |
| `content`          | String        | Content to cache.                         |
| `options.compress` | Boolean       | Enable compression for this entry.        |
| `options.expire`   | Number        | Expiration time in milliseconds.          |
| `options.search`   | Array<String> | Keywords to enable search for this entry. |

---

#### **`get(key)`**
Retrieves cached content by its key.

| Parameter | Type   | Description                      |
| --------- | ------ | -------------------------------- |
| `key`     | String | Unique identifier for the cache. |

**Returns:** `Promise<String>` - Cached content.

---

#### **`exist(key)`**
Checks if a key exists in the cache.

| Parameter | Type   | Description                      |
| --------- | ------ | -------------------------------- |
| `key`     | String | Unique identifier for the cache. |

**Returns:** `Boolean` - `true` if the key exists, otherwise `false`.

---

#### **`del(key)`**
Deletes a cached entry by its key.

| Parameter | Type   | Description                      |
| --------- | ------ | -------------------------------- |
| `key`     | String | Unique identifier for the cache. |

---

#### **`search(keywords, logic)`**
Searches for cached entries based on keywords.

| Parameter  | Type                | Default | Description                       |
| ---------- | ------------------- | ------- | --------------------------------- |
| `keywords` | Array<String>       | `[]`    | Keywords to search for.           |
| `logic`    | String (`AND`/`OR`) | `AND`   | Logic to apply during the search. |

**Returns:** `Array<String>` - Matching cache keys.

---

#### **`publish(key, message)`** (>= 1.5.1)
Publish event

| Parameter  | Type                | Default | Description                       |
| ---------- | ------------------- | ------- | --------------------------------- |
| `key` | String       |     | Key or event.           |
| `message`    | any |    | Message publish to event. |

---

#### **`subscribe(key, listener)`** (>= 1.5.1)
Subscribe event

| Parameter  | Type                | Default | Description                       |
| ---------- | ------------------- | ------- | --------------------------------- |
| `key` | String       |     | Key or event.           |
| `logic`    | function(message) |    | Listen event publish. |

*Ex:*
```javascript
const storage = new CacheFile(configDefault)
storage.setup()

storage.subscribe("event-1", async (message) => {
		console.log("listener 1", message)
})

storage.publish("event-1", contentNumber)
```

---

### Configuration Example

To customize the cache configuration:

```javascript
const cache = new CacheFile({
  folder: './cache-directory',
  expire: 60000,         // Default expiration time: 60 seconds
  autoCompress: true,    // Enable automatic compression
  log: true,             // Enable logging
});
```

---

## Advanced Features

### **Compression**
Uses [Snappy](https://github.com/google/snappy) for fast and lightweight compression. To enable compression:

```javascript
await cache.set('key', 'content', { compress: true });
```

### **Expiration Handling**
Automatically removes expired entries:

```javascript
await cache.set('tempKey', 'tempData', { expire: 5000 }); // Expires in 5 seconds
```

---

## Contributions

We welcome contributions! Please create a pull request or submit issues on GitHub.

---

## License

**BAMIMI Cache** is open-source software licensed under the [MIT License](LICENSE).