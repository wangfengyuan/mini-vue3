export let activeEffect: any = null;

export type Dep = Set<ReactiveEffect>

export type ReactiveEffectOptions = {
  scheduler?: Function
}

export class ReactiveEffect {
  public scheduler: Function | null = null;
  public deps: Dep[] = []
  constructor(public fn) {
  }
  run() {
    cleanupEffect(this);
    activeEffect = this;
    return this.fn();
  }
}

export function effect(fn, option: ReactiveEffectOptions = {}) {
  const reactiveEffect = new ReactiveEffect(fn);
  Object.assign(reactiveEffect, option)
  reactiveEffect.run();
  return reactiveEffect.run.bind(reactiveEffect)
}

function cleanupEffect(effect: ReactiveEffect) {
  const { deps } = effect;
  deps.forEach(dep => {
    dep.delete(effect)
  });
  effect.deps.length = 0;
}