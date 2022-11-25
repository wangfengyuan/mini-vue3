import { trackEffects, triggerEffects } from './effect';
import { hasChanged } from '@mini-vue3/shared';

export class RefImpl {
  private _value: any;
  public dep;
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