import { extend } from '@mini-vue3/shared';

export let activeEffect: any = null;

export type Dep = Set<ReactiveEffect>

export type ReactiveEffectOptions = {
  scheduler?: Function
  onStop?: Function
}

const effectStack: ReactiveEffect[]  = []

export class ReactiveEffect {
  public scheduler: Function | null = null;
  onStop?: () => void;
  active = true;
  public deps: Dep[] = []
  constructor(public fn) {
  }
  run() {
    cleanupEffect(this);
    activeEffect = this;
    // 当前副作用函数入栈
    effectStack.push(this);
    const res = this.fn();
    // 调用之后将当前副作用函数出站，并将activeEffect还原
    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];
    return res;
  }
  stop() {
    if (this.active) {
      cleanupEffect(this);
      if (this.onStop) {
        this.onStop();
      }
      this.active = false;
    }
  }
}

export function effect(fn, option: ReactiveEffectOptions = {}) {
  const reactiveEffect = new ReactiveEffect(fn);
  extend(reactiveEffect, option)
  reactiveEffect.run();
  const runner: any = reactiveEffect.run.bind(reactiveEffect);
  runner.effect = reactiveEffect;
  return runner;
}

export function stop(runner) {
  runner.effect.stop();
}

function cleanupEffect(effect: ReactiveEffect) {
  const { deps } = effect;
  deps.forEach(dep => {
    dep.delete(effect)
  });
  effect.deps.length = 0;
}