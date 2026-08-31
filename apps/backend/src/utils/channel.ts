/**
 *  This is the custom Channel<T> implementation in TypeScript, which is similar to the System.Threading.Channels.Channel<T> in C#.
 *  Usage:
 */

interface ChannelReader<T> {
  read(): Promise<T>;
  tryRead(): T | undefined;
  waitToReadAsync(): Promise<boolean>;
}

interface ChannelWriter<T> {
  write(item: T): void;
  tryWrite(item: T): boolean;
  waitToWriteAsync(): Promise<boolean>;
  complete(): void;
}

interface ReadWaiter {
  resolve: (value: boolean) => void;
  reject: (error: Error) => void;
}
export class Channel<T> {
  private readonly buffer: T[] = [];

  private readonly readWaiters: Array<{
    resolve: (value: T) => void;
    reject: (error: Error) => void;
  }> = [];

  private readonly readAvailabilityWaiters: ReadWaiter[] = [];
  private readonly writeAvailabilityWaiters: ReadWaiter[] = [];

  private closed = false;

  constructor(private readonly maxCapacity: number = Infinity) {
    if (maxCapacity <= 0) {
      throw new Error('Channel capacity must be greater than 0.');
    }
  }

  readonly reader: ChannelReader<T> = {
    read: () => this.read(),

    tryRead: () => this.tryRead(),

    waitToReadAsync: () => this.waitToReadAsync(),
  };

  readonly writer: ChannelWriter<T> = {
    write: (item) => this.write(item),

    tryWrite: (item) => this.tryWrite(item),

    waitToWriteAsync: () => this.waitToWriteAsync(),

    complete: () => this.complete(),
  };

  // ------------------ Implementation for Writer --------------------------

  private write(item: T): void {
    if (this.closed) {
      throw new Error('Channel is closed.');
    }

    // If a reader is already waiting, deliver directly.
    const reader = this.readWaiters.shift();

    if (reader) {
      reader.resolve(item);
      return;
    }

    if (this.buffer.length >= this.maxCapacity) {
      throw new Error('Channel is full.');
    }

    this.buffer.push(item);

    this.notifyReaders();

    // Capacity may have changed from empty -> non-empty,
    // but writer availability is still true unless full.
    this.notifyWriters();
  }

  private tryWrite(item: T): boolean {
    if (this.closed) {
      return false;
    }

    const reader = this.readWaiters.shift();

    if (reader) {
      reader.resolve(item);
      return true;
    }

    if (this.buffer.length >= this.maxCapacity) {
      return false;
    }

    this.buffer.push(item);

    this.notifyReaders();
    this.notifyWriters();

    return true;
  }

  private waitToWriteAsync(): Promise<boolean> {
    if (this.closed) {
      return Promise.resolve(false);
    }

    if (this.buffer.length < this.maxCapacity) {
      return Promise.resolve(true);
    }

    return new Promise<boolean>((resolve, reject) => {
      this.writeAvailabilityWaiters.push({
        resolve,
        reject,
      });
    });
  }

  private notifyWriters(): void {
    if (this.closed || this.buffer.length >= this.maxCapacity) {
      return;
    }

    while (this.writeAvailabilityWaiters.length > 0) {
      const waiter = this.writeAvailabilityWaiters.shift()!;
      waiter.resolve(true);
    }
  }

  private complete(): void {
    if (this.closed) {
      return;
    }

    this.closed = true;

    // No more writes.
    while (this.writeAvailabilityWaiters.length > 0) {
      const waiter = this.writeAvailabilityWaiters.shift()!;
      waiter.resolve(false);
    }

    // Existing buffered items can still be consumed.
    if (this.buffer.length > 0) {
      while (this.readAvailabilityWaiters.length > 0) {
        const waiter = this.readAvailabilityWaiters.shift()!;
        waiter.resolve(true);
      }

      return;
    }

    // No buffered items remain.
    while (this.readAvailabilityWaiters.length > 0) {
      const waiter = this.readAvailabilityWaiters.shift()!;
      waiter.resolve(false);
    }

    // Readers waiting directly for an item must be released.
    while (this.readWaiters.length > 0) {
      const waiter = this.readWaiters.shift()!;
      waiter.reject(new Error('Channel is closed.'));
    }
  }

  // ------------------ Implementation for Reader --------------------------

  private async read(): Promise<T> {
    const item = this.tryRead();

    if (item !== undefined) {
      return item;
    }

    if (this.closed) {
      throw new Error('Channel is closed.');
    }

    return new Promise<T>((resolve, reject) => {
      this.readWaiters.push({
        resolve,
        reject,
      });
    });
  }

  private tryRead(): T | undefined {
    if (this.buffer.length === 0) {
      return undefined;
    }

    const item = this.buffer.shift()!;

    // A previously full channel may now have capacity.
    this.notifyWriters();

    return item;
  }

  private waitToReadAsync(): Promise<boolean> {
    if (this.buffer.length > 0) {
      return Promise.resolve(true);
    }

    if (this.closed) {
      return Promise.resolve(false);
    }

    return new Promise<boolean>((resolve, reject) => {
      this.readAvailabilityWaiters.push({
        resolve,
        reject,
      });
    });
  }

  private notifyReaders(): void {
    if (this.buffer.length === 0) {
      return;
    }

    while (this.readAvailabilityWaiters.length > 0) {
      const waiter = this.readAvailabilityWaiters.shift()!;
      waiter.resolve(true);
    }
  }

  // ------------------ Properties --------------------------

  get count(): number {
    return this.buffer.length;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  // ------------------ Static Factory Methods --------------------------

  static createUnbounded<T>(): Channel<T> {
    return new Channel<T>(Infinity);
  }

  static createBounded<T>(capacity: number): Channel<T> {
    return new Channel<T>(capacity);
  }
}
