import { readonly, isReadonly } from "../reactive";
import { effect } from "../effect";

describe("readonly", () => {
  it("readonly可读，意味着无法修改，因此无需建立响应联系", () => {
    const proxy = readonly({ n: 1 })
    const spy = vi.fn(() => console.log(proxy.n));
    effect(() => spy())
    expect(spy).toBeCalledTimes(1);
    proxy.n = 2
    expect(spy).toBeCalledTimes(1);
  });

  it("readonly后尝试设置属性时console.warn警告", () => {
    console.warn = vi.fn();
    const user = readonly({
      age: 10,
    });

    user.age = 11;
    expect(console.warn).toHaveBeenCalledWith('属性age是只读的');
  });
  it("isReadonly判断是否是可读的", () => {
    const original = { foo: 1 };
    const observed = readonly(original);
    expect(observed).not.toBe(original);
    expect(isReadonly(observed)).toBe(true);
    expect(isReadonly(original)).toBe(false);
  });
});