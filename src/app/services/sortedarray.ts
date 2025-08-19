// An array that keeps the proper sort order at all time.
// Backed by a normal array.

import { computed, Signal, signal, WritableSignal } from "@angular/core";

// Sort function is provided in the constructor.
export class SortedArray<T> {
    private items: WritableSignal<T[]> = signal([]);

    // Public signal for array size
    readonly sizeSignal: Signal<number> = computed(() => this.items().length);

    // private items: T[] = [];
    private compareFunction!: (o1: T, o2: T) => number;

    constructor(compareFunction: (o1: T, o2: T) => number) {
        this.compareFunction = compareFunction;
    }

    contains(item: T, comparator: (a: T, b: T) => boolean) {
        return this.items().some(x => comparator(x, item));
    }

    add(item: T): void {
        const index = this.findInsertIndex(item);
        this.items().splice(index, 0, item);
    }

    findIndex(filterFn: (item: any) => boolean): number {
        return this.items().findIndex(filterFn);
    }

    private findInsertIndex(item: T): number {
        let low = 0;
        let high = this.items.length;

        while (low < high) {
            const mid = Math.floor((low + high) / 2);
            const cmp = this.compareFunction(item, this.items()[mid]);

            if (cmp < 0) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }

        return low;
    }

    getAll(): T[] {
        return [...this.items()];
    }

    get(index: number): T | undefined {
        return this.items()[index];
    }

    remove(index: number): T | undefined {
        if (index >= 0 && index < this.items().length) {
            return this.items().splice(index, 1)[0];
        }
        return undefined;
    }

    size(): number {
        return this.items().length;
    }

    clear(): void {
        this.items.set([]);
    }

    resort(): void {
       this.items().sort(this.compareFunction);
    }

    reload(newItems: T[]): void {
        newItems.sort(this.compareFunction);
        this.items.set(newItems);
    }

    [Symbol.iterator](): Iterator<T> {
        let index = 0;
        const data = this.items();

        return {
            next(): IteratorResult<T> {
                if (index < data.length) {
                    return { value: data[index++], done: false };
                } else {
                    return { value: undefined as any, done: true };
                }
            }
        };
    }
    
    public forEach(callback: (item: T, index: number, array: T[]) => void): void {
        this.items().forEach(callback);
    }
}
