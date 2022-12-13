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
  if (typeof children === "string" || typeof children === "number") {
    vnode.shapeFlag |= ShapeFlags.TEXT_CHILDREN;
  } else if (Array.isArray(children)) {
    vnode.shapeFlag |= ShapeFlags.ARRAY_CHILDREN;
  }

  return vnode;
}