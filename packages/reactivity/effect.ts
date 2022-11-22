import { extend } from '@mini-vue3/shared';

export let activeEffect: any = null;

export type Dep = Set<ReactiveEffect>

export type ReactiveEffectOptions = {
  scheduler?: Function
  onStop?: Function
}

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
    return this.fn();
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