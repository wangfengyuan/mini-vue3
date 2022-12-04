import { isFunction, isObject } from "@mini-vue3/shared";

export function createComponentInstance(vnode) {
  const type = vnode.type // 用户自己传入的属性
  // 定义组件实例，包含与组件有关的状态信息
  const instance = {
    vnode, // 实例对应的虚拟节点
    type, // 组件对象
    // 组件自身的状态数据，即data
    data: type.data(),
    isMounted: false, // 是否被挂载完成
    subTree: null, // 组件渲染完成后返回的内容, 即子树
  }
  return instance;
}

export function setupComponent(instance) {
  // TODO
  // initProps()
  // initSlots()
  setupStatefulComponent(instance);
}

export function setupStatefulComponent(instance) {
  const Component = instance.type;
  const { setup } = Component;

  if (setup) {
    const setupResult = setup();

    handleSetupResult(instance, setupResult);
  }
}

export function handleSetupResult(instance, setupResult) {
  const { render } = instance.type;
  // 如果setup返回的是函数，将其返回作为渲染函数
  if (isFunction(setupResult)) {
    // 报告冲突
    if (render) console.warn('setup返回渲染函数,忽略render函数')
    instance.render = setupResult;
  } else if (isObject(setupResult)) {
    // 如果setup返回值不是函数，则作为数据状态赋值给setupState
    instance.setupState = setupResult;
  }
}