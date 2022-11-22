import { effect } from "../effect";
import { reactive } from "../reactive";

describe("effect", () => {
  it('effect会执行一次', () => {
    const fnSpy = vi.fn(() => {})
    effect(fnSpy)
    expect(fnSpy).toHaveBeenCalledTimes(1)
  })
  it("依赖变量变化时effect自动执行", () => {
    const user = reactive({
      age: 10,
    });

    let nextAge;
    effect(() => {
      nextAge = user.age + 1;
    });

    expect(nextAge).toBe(11);

    user.age++;
    expect(nextAge).toBe(12);
  });
  it("分支切换与cleanup", () => {
    const data = { ok: true, text: 'hello world' };
    const obj = reactive(data);
    const fnSpy = vi.fn(() => { console.log(obj.ok ? obj.text : 'not')})
    effect(fnSpy)
    expect(fnSpy).toHaveBeenCalledTimes(1);
    obj.ok = false;
    expect(fnSpy).toHaveBeenCalledTimes(2);
    obj.text = '111'; // 清除effect重新再次收集，obj.ok = false;后obj.text与effect无依赖关系
    expect(fnSpy).toHaveBeenCalledTimes(2);
  });
  it('effect返回runner,主动调用可以触发执行', () => {
    let foo = 0;
    const runner = effect(() => {
      foo++;
      return foo;
    });
    expect(foo).toBe(1);
    runner();
    expect(foo).toBe(2);
    expect(runner()).toBe(3);
  })
  it('支持scheduler调度', () => {
    let dummy
    let run: any
    const scheduler = vi.fn(() => {
      run = runner
    })
    const obj = reactive({ foo: 1 })
    const runner = effect(
      () => {
        dummy = obj.foo
      },
      { scheduler }
    )
    expect(scheduler).not.toHaveBeenCalled()
    expect(dummy).toBe(1)
    // should be called on first trigger
    obj.foo++
    expect(scheduler).toHaveBeenCalledTimes(1)
    // should not run yet
    expect(dummy).toBe(1)
    // manually run
    run()
    // should have run
    expect(dummy).toBe(2)
  })
});
