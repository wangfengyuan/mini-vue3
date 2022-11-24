import { track, trigger } from './reactive';

const get = createGetter();
const set = createSetter();

function createGetter() {
  return function get(target, key, receiver) {
    track(target, key);
    const res = Reflect.get(target, key, receiver)
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
