// A Map-backed cache with a maximum size.
// Keeps only those most recently accessed <maxSize> items.
export class BoundedMap<K, V> extends Map<K, V>{
  private readonly maxSize: number;

  constructor(maxSize: number = 100) {
    super();
    this.maxSize = maxSize;
  }

  override set(key: K, value: V): this {
    // If the key already exists, delete it and reinsert at the end of the Map
    if (super.has(key)) {
      super.delete(key);
    }
    super.set(key, value);

    // If this insert causes the Map to exceed maxSize, delete the oldest key
    if (this.size > this.maxSize) {
      const oldestKey = this.keys().next().value!;
      super.delete(oldestKey);
    }

    return this;
  }

  // When a get() happens, delete and reinsert at the end of the Map
  override get(key: K): V | undefined {
    const value = super.get(key);
    if (value !== undefined) {
      super.delete(key);
      super.set(key, value);
    }
    return value;
  }

  // Get without reinserting at the top
  getWithoutReinsert(key: K): V | undefined {
    return super.get(key);
  }
}
