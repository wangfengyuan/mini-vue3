import { createVNode } from "./vnode";

export function h(tag, props?, children?) {
  return createVNode(tag, props, children);
};