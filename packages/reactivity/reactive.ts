import { activeEffect, Dep } from './effect';
import { mutableHandlers, shallowReactiveHandlers, shallowReadonlyHandlers, readonlyHandlers } from './baseHandler';

const bucket: WeakMap<Object, Map<string, Dep>>= new WeakMap();

export const enum ReactiveFlags {
  IS_REACTIVE = '__v_isReactive',
  IS_READONLY = '__v_isReadonly',
}

export function isReactive(value) {
  return !!value[ReactiveFlags.IS_REACTIVE];
}

export function isReadonly(value) {
  return !!value[ReactiveFlags.IS_READONLY];
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
  deps.add(activeEffect);
  activeEffect.deps.push(deps);
}


export function trigger(target, key) {
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


export function reactive(raw) {
  // 第二个参数代表是否为浅响应，默认为false,即非浅响应
  return createReactiveObject(raw, mutableHandlers)
}

export function readonly(raw) {
  return createReactiveObject(raw, readonlyHandlers);
}

export function shallowReactive(raw) {
  return createReactiveObject(raw, shallowReactiveHandlers)
} 

export function shallowReadonly(raw) {
  return createReactiveObject(raw, shallowReadonlyHandlers);
}

function createReactiveObject(target, baseHandlers) {
  return new Proxy(target, baseHandlers);
}