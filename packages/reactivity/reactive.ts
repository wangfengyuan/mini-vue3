import { activeEffect } from './effect';

const bucket = new WeakMap();

function track(target, key) {
  if (!activeEffect) return;
  let depsMap = bucket.get(target);
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()))
  }
  let deps = depsMap.get(key);
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }
  deps.add(activeEffect);
}


function trigger(target, key) {
  const depsMap = bucket.get(target);
  const effects = depsMap.get(key);
  effects && effects.forEach(fn => fn());
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