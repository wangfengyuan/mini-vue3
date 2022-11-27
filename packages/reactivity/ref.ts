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