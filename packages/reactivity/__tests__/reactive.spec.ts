import { reactive, isReactive } from "../reactive";
describe("reactive", () => {
  it("isReactive判断是否是响应式的", () => {
    const original = { foo: 1 };
    const observed = reactive(original);
    expect(observed).not.toBe(original);
    expect(observed.foo).toBe(1);
    expect(isReactive(observed)).toBe(true);
    expect(isReactive(original)).toBe(false);
  });
});