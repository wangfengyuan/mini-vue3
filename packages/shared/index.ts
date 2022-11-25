export const extend = Object.assign;
export const isObject = val => val !== null && typeof val === 'object';
export const hasChanged = (value: any, oldValue: any): boolean =>
  !Object.is(value, oldValue)