import { isFunction, isObject } from "@mini-vue3/shared";
import { PublicInstanceProxyHandlers } from "./componentPublicInstance";

export function createComponentInstance(vnode) {
  const type = vnode.type // 用户自己传入的属性
  const data = (type.data && isFunction(type.data) ? type.data() : type.data) || {}
  // 定义组件实例，包含与组件有关的状态信息
  const instance = {
    vnode, // 实例对应的虚拟节点
    type, // 组件对象
    isMounted: false, // 是否被挂载完成
    subTree: null, // 组件渲染完成后返回的内容, 即子树
    proxy: null, // 实例的代理对象
    ctx: {}, // 组件上下文
    setupState: {},  // 组件中setup的返回值 {方法，属性} 
    props: {}, // 组件属性 //组件中定义了的propsOptions叫做props
    data, //data响应式对象
  }
  instance.ctx = { _: instance }
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
  // 创建一个代理对象来聚合所有响应式对象
  instance.proxy = new Proxy(instance.ctx, PublicInstanceProxyHandlers)

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
  if (!instance.render) {
    instance.render = render;
  }
}