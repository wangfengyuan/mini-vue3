import { ref, isRef, unRef, toRef, toRefs, proxyRefs } from '../ref';
import { effect } from '../effect';
import { reactive } from '../reactive';

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
  it("isRef方法", () => {
    const a = ref(1);
    const user = reactive({
      age: 1,
    });
    expect(isRef(a)).toBe(true);
    expect(isRef(1)).toBe(false);
    expect(isRef(user)).toBe(false);
  });

  it("unRef能解套ref", () => {
    const a = ref(1);
    expect(unRef(a)).toBe(1);
    expect(unRef(1)).toBe(1);
  });
  it("toRef用户解构属性时仍然具有响应式", () => {
    const a = reactive({
      x: 1
    })
    const x = toRef(a, 'x')
    expect(isRef(x)).toBe(true)
    expect(x.value).toBe(1)

    // source -> proxy
    a.x = 2
    expect(x.value).toBe(2)

    // proxy -> source
    x.value = 3
    expect(a.x).toBe(3)

    // should keep ref
    const r = { x: ref(1) }
    expect(toRef(r, 'x')).toBe(r.x)
  });
  it("toRefs用户解构对象全部属性", () => {
    const a = reactive({
      x: 1,
      y: 2
    })

    const { x, y } = toRefs(a)

    expect(isRef(x)).toBe(true)
    expect(isRef(y)).toBe(true)
    expect(x.value).toBe(1)
    expect(y.value).toBe(2)
  });
  it("proxyRefs", () => {
    const user = {
      age: ref(10),
      name: "xiaohong",
    };

    const proxyUser = proxyRefs(user);
    expect(user.age.value).toBe(10);
    expect(proxyUser.age).toBe(10);
    expect(proxyUser.name).toBe("xiaohong");

    proxyUser.age = 20;

    expect(proxyUser.age).toBe(20);
    expect(user.age.value).toBe(20);

    proxyUser.age = ref(10);
    expect(proxyUser.age).toBe(10);
    expect(user.age.value).toBe(10);
  });
})