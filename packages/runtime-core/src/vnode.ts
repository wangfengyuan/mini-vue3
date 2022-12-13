import { isFunction, isObject, isString, ShapeFlags } from "@mini-vue3/shared";

export function createVNode(type, props?, children?) {
  // 描述虚拟节点的类型
  const shapeFlag =
    isString(type)
    ? ShapeFlags.ELEMENT
      : isFunction(type)
        ? ShapeFlags.FUNCTIONAL_COMPONENT
        : isObject(type)
          ? ShapeFlags.STATEFUL_COMPONENT
          : 0
  const vnode = {
    type,
    props,
    children,
    shapeFlag,
  };

  return vnode;
}