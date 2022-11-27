import { isReadonly, shallowReadonly } from "../src";

describe("shallowReadonly", () => {
  test("shallowReadonly设置后深层属性是可赋值的", () => {
    const props = shallowReadonly({ n: { foo: 1 } });
    expect(isReadonly(props)).toBe(true);
    expect(isReadonly(props.n)).toBe(false);
  });
});