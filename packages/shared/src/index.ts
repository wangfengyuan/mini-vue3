export const extend = Object.assign;
export const isObject = val => val !== null && typeof val === 'object';
export const isString = (value: unknown): value is String => typeof value === 'string';
export const hasChanged = (value: any, oldValue: any): boolean =>
  !Object.is(value, oldValue)

export const isFunction = (value: unknown): value is Function => typeof value === 'function';
const hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn = (target, key) => hasOwnProperty.call(target, key)

export { ShapeFlags } from './shapeFlags';