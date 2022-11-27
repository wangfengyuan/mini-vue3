import { extend } from '@mini-vue3/shared';

export let activeEffect: any = null;
const bucket: WeakMap<Object, Map<string, Dep>>= new WeakMap();

export type Dep = Set<ReactiveEffect>

export type ReactiveEffectOptions = {
  scheduler?: Function
  onStop?: Function
}

const effectStack: ReactiveEffect[]  = []

export class ReactiveEffect {
  onStop?: () => void;
  active = true;
  public deps: Dep[] = []
  constructor(public fn, public scheduler) {
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

export function track(target, key) {
  if (!activeEffect) return;
  let depsMap: Map<string, Dep> | undefined = bucket.get(target);
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map<string, Dep>()))
  }
  let deps: Dep | undefined = depsMap.get(key);
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }
  // 看看 dep 之前有没有添加过，添加过的话 那么就不添加了
  trackEffects(deps);
}

export function trackEffects(deps) {
  if (!activeEffect) return;
  if (deps.has(activeEffect)) return;
  deps.add(activeEffect);
  activeEffect.deps.push(deps);
}

export function triggerEffects(deps) {
  const effectsToRun: Dep = new Set(deps);
  effectsToRun.forEach(fn => {
    if (fn.scheduler) {
      fn.scheduler();
    } else {
      fn.run()
    }
  });
}

export function trigger(target, key) {
  const depsMap = bucket.get(target)!;
  const effects = depsMap && depsMap.get(key);
  effects && triggerEffects(effects);
}