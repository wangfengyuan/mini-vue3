import { createAppAPI } from './apiCreateApp';
import { createComponentInstance, setupComponent } from './component';
export { h } from './h';

export function createRenderer(renderOptions) {

  const {
    insert: hostInsert,
    createElement: hostCreateElement,
    setElementText: hostSetElementText,
  } = renderOptions;

  const patch = (n1, n2, container) => {
    const { type } = n2;
    if (typeof type === 'object') {
      processComponent(n1, n2, container);
    } else {
      processElement(n1, n2, container);
    }
  }

  const setupRenderEffect = (instance, container) => {
    console.log('初始化调用render');
    const subTree = instance.render.call(instance.setupState, instance.setupState);
    patch(null, subTree, container);
  }

  function mountComponent(vnode: any, container) {
    // 1、给组件创造一个基础组件实例 
    const instance = createComponentInstance(vnode);
  
    // 2、给组件的实例进行赋值
    setupComponent(instance);
    // 3、调用render方法实现组件的渲染逻辑（首次渲染即需要render函数中所有依赖的响应式对象 =>依赖收集）
    setupRenderEffect(instance, container);
  }

  const processComponent = (n1, n2, container) => {
    mountComponent(n2, container);
  }

  const mountElement = (n2, container) => {
    const { type, children } = n2;
    const el = n2.el = hostCreateElement(type as string);
    if (typeof children === 'string') {
      hostSetElementText(el, children);
    }
    hostInsert(el, container);
  }

  const processElement = (n1, n2, container) => {
    if (!n1) {
      mountElement(n2, container);
    }
  }

  // 将虚拟节点转化成真实节点渲染到容器中
  const render = (vnode, container) => {
    // 更新和创建
    patch(container._vnode || null, vnode, container);
  };
  return {
    render,
    createApp: createAppAPI(render),
  }
}

