import { track, trigger, reactive } from './reactive';
import { isObject } from '@mini-vue3/shared';

const get = createGetter();
const set = createSetter();
const shallowGet = createGetter(true);

function createGetter(isShallow = false) {
  return function get(target, key, receiver) {
    track(target, key);
    // 得到原始结果
    const res = Reflect.get(target, key, receiver)
    if (isShallow) {
      return res;
    }
    if (isObject(res)) {
      // 如果是对象，调用reactive将结果包装成响应式并返回
      return reactive(res)
    }
    return res;
  };
}

function createSetter() {
  return function set(target, key, value, receiver) {
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