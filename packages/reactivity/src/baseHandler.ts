import { reactive, ReactiveFlags, readonly } from './reactive';
import { track, trigger } from './effect';
import { isObject } from '@mini-vue3/shared/src';

const get = createGetter();
const set = createSetter();
const shallowGet = createGetter(false, true);
const readonlyGet = createGetter(true);
const readonlySet = createSetter(true);
const shallowReadonlyGet = createGetter(true, true);

function createGetter(isReadonly = false, isShallow = false) {
  return function get(target, key, receiver) {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly;
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly;
    }
    if (!isReadonly) {
      track(target, key);
    } 
    // 得到原始结果
    const res = Reflect.get(target, key, receiver)
    if (isShallow) {
      return res;
    }
    if (isObject(res)) {
      // 如果是对象，调用reactive将结果包装成响应式并返回
      return isReadonly ? readonly(res): reactive(res)
    }
    return res;
  };
}

function createSetter(isReadonly = false) {
  return function set(target, key, value, receiver) {
    if (isReadonly) {
      console.warn(`属性${key}是只读的`);
      return true;
    }
    const res = Reflect.set(target, key, value, receiver);
    trigger(target, key);
    return res;
  };
}

export const mutableHandlers = {
  get,
  set,
}

export const shallowReactiveHandlers = {
  get: shallowGet,
  set,
}

export const shallowReadonlyHandlers = {
  get: shallowReadonlyGet,
  set: readonlySet,
}

export const readonlyHandlers = {
  get: readonlyGet,
  set: readonlySet,
}