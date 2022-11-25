import { ref } from '../ref';
import { effect } from '../effect';

describe('ref', () => {
  it("ref有value属性，对应原始值", () => {
    const a = ref(1);
    expect(a.value).toBe(1);
  });
  it("ref也是响应式的，应该进行依赖收集", () => {
    const a = ref(1);
    let dummy;
    let calls = 0;
    effect(() => {
      calls++;
      dummy = a.value;
    });
    expect(calls).toBe(1);
    expect(dummy).toBe(1);
    a.value = 2;
    expect(calls).toBe(2);
    expect(dummy).toBe(2);
    // same value should not trigger
    a.value = 2;
    expect(calls).toBe(2);
    expect(dummy).toBe(2);
  });
})