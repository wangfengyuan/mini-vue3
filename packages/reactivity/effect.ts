export let activeEffect: any = null;

export type Dep = Set<ReactiveEffect>

export class ReactiveEffect {
  deps: Dep[] = []
  constructor(public fn) {
  }
  run() {
    cleanupEffect(this);
    activeEffect = this;
    return this.fn();
  }
}

export function effect(fn) {
  const reactiveEffect = new ReactiveEffect(fn);
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