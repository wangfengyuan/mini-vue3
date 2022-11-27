import { trackEffects, triggerEffects } from './effect';
import { hasChanged } from '@mini-vue3/shared';

export class RefImpl {
  private _value: any;
  public dep;
  public readonly __v_isRef = true;
  constructor(value) {
    this._value = value;
    this.dep = new Set();
  }
  get value() {
    trackRef(this);
    return this._value
  }
  set value(val) {
    if (hasChanged(val, this._value)) {
      this._value = val;
      triggerEffects(this.dep);
    }
  }
}

export function ref(value) {
  return new RefImpl(value)
}

export function trackRef(ref) {
  trackEffects(ref.dep);
}

export function isRef(r: any) {
  return !!(r && r.__v_isRef === true);
}

export function unRef(r) {
  return isRef(r) ? r.value : r;
}

export function toRef(obj, key) {
  const wrapper =  {
    get value() {
      return obj[key];
    },
    set value(val) {
      obj[key] = val
    }
  }
  Object.defineProperty(wrapper, '__v_isRef', {
    value: true,
  })
  const val = obj[key]
  return isRef(val) ? val : wrapper;
}

export function toRefs(obj): any {
  const ret = {};
  for (const key in obj) {
    ret[key] = toRef(obj, key);
  }
  return ret;
}

export function proxyRefs(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      // 如果读取的是ref返回它的value属性值
      return value.__v_isRef ? value.value :value;
    },
    set(target, key, newValue, receiver) {
      // 通过target读取真实值
      const value = target[key];
      // 如果值是ref，则设置value属性值
      if (isRef(value) && !isRef(newValue)) {
        value.value = newValue;
        return true;
      }
      return Reflect.set(target, key, newValue, receiver);
    }
  })
}