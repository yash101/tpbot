export type Unsub = () => void;
export class Signal<T> {
  private value: T;
  private subs = new Set<(value: T) => void>();
  
  constructor(value: T) {
    this.value = value;
  }

  get(): T {
    return this.value;
  }

  set(value: T) {
    if (this.value === value)
      return;

    this.value = value;
    for (const sub of this.subs) {
      sub(value);
    }
  }

  subscribe(cb: (value: T) => void): Unsub {
    this.subs.add(cb);
    return () => {
      this.subs.delete(cb);
    };
  }
}
