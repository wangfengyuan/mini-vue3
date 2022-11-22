import { activeEffect, Dep } from './effect';

const bucket: WeakMap<Object, Map<string, Dep>>= new WeakMap();

function track(target, key) {
  if (!activeEffect) return;
  let depsMap: Map<string, Dep> | undefined = bucket.get(target);
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map<string, Dep>()))
  }
  let deps: Dep | undefined = depsMap.get(key);
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }
  deps.add(activeEffect);
  activeEffect.deps.push(deps);
}


function trigger(target, key) {
  const depsMap = bucket.get(target)!;
  const effects = depsMap.get(key);
  const effectsToRun: Dep = new Set(effects);
  effectsToRun.forEach(fn => {
    if (fn.scheduler) {
      fn.scheduler();
    } else {
      fn.run()
    }
  });
}


export function reactive(data) {
  return new Proxy(data, {
    get(target, key, receiver) {
      track(target, key);
      return Reflect.get(target, key, receiver)
    },
    set(target, key, val, receiver) {
      const res = Reflect.set(target, key, val, receiver);
      trigger(target, key);
      return res;
    }
  })
}