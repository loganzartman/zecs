import { uuid } from './uuid';

describe('uuid', () => {
  it('should generate a unique identifier', () => {
    const a = uuid();
    const b = uuid();
    expect(a).not.toBe(b);
  });

  it('should generate a 22-character string', () => {
    const id = uuid();
    expect(id).toHaveLength(22);
  });

  it('should generate many unique values', () => {
    const N = 10000;
    const ids = new Set<string>();
    for (let i = 0; i < N; i++) {
      ids.add(uuid());
    }
    expect(ids.size).toBe(N);
  });
});
