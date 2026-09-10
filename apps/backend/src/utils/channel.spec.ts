import { Channel } from './channel';

describe('Channel', () => {
  it('delivers a written value to a reader', async () => {
    const channel = Channel.createBounded<string>(1);

    channel.writer.write('hello');

    await expect(channel.reader.read()).resolves.toBe('hello');
  });

  it('coalesces writes at capacity-1: a second write is refused while full', () => {
    const channel = Channel.createBounded<'wake'>(1);

    expect(channel.writer.tryWrite('wake')).toBe(true);
    expect(channel.writer.tryWrite('wake')).toBe(false);
    expect(channel.count).toBe(1);
  });

  it('frees capacity when the reader consumes', () => {
    const channel = Channel.createBounded<'wake'>(1);

    channel.writer.tryWrite('wake');
    expect(channel.reader.tryRead()).toBe('wake');

    expect(channel.writer.tryWrite('wake')).toBe(true);
  });

  it('throws from write() when the buffer is full', () => {
    const channel = Channel.createBounded<number>(1);

    channel.writer.write(1);

    expect(() => channel.writer.write(2)).toThrow(/full/i);
  });

  it('wakes a blocked reader when a value is written', async () => {
    const channel = Channel.createBounded<string>(1);

    const read = channel.reader.read();
    channel.writer.tryWrite('wake');

    await expect(read).resolves.toBe('wake');
  });

  it('waitToReadAsync resolves false once the channel is completed empty', async () => {
    const channel = Channel.createBounded<string>(1);

    const waiter = channel.reader.waitToReadAsync();
    channel.writer.complete();

    await expect(waiter).resolves.toBe(false);
  });

  it('rejects a blocked read when the channel is completed', async () => {
    const channel = Channel.createBounded<string>(1);

    const read = channel.reader.read();
    channel.writer.complete();

    await expect(read).rejects.toThrow(/closed/i);
  });

  it('rejects writes after completion', () => {
    const channel = Channel.createBounded<string>(1);

    channel.writer.complete();

    expect(() => channel.writer.write('nope')).toThrow(/closed/i);
    expect(channel.writer.tryWrite('nope')).toBe(false);
  });

  it('rejects a non-positive capacity', () => {
    expect(() => new Channel<number>(0)).toThrow(/capacity/i);
  });
});
