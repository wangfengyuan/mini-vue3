import { reactive, shallowReactive, effect } from "../src";

describe("shallowReactive", () => {
  it('reactive默认是深度响应式', () => {
    const proxy = reactive({ n: { foo: 1 } })
    const spy = vi.fn(() => console.log(proxy.n.foo));
    effect(() => spy())
    expect(spy).toBeCalledTimes(1);
    proxy.n = { foo: 2 }
    expect(spy).toBeCalledTimes(2);
    proxy.n.foo = 3;
    expect(spy).toBeCalledTimes(3);
  })
  it('shallowReactive是浅响应式，只代理第一层', () => {
    const proxy = shallowReactive({ n: { foo: 1 } })
    const spy = vi.fn(() => console.log(proxy.n.foo));
    effect(() => spy())
    expect(spy).toBeCalledTimes(1);
    proxy.n = { foo: 2 }
    expect(spy).toBeCalledTimes(2);
    proxy.n.foo = 3;
    expect(spy).toBeCalledTimes(2);
  })

});