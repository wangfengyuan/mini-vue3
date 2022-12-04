import { createAppAPI } from './apiCreateApp';
import { createComponentInstance, setupComponent } from './component';
export { h } from './h';

export function createRenderer(renderOptions) {

  const patch = (vnode, container) => {
    processComponent(vnode, container);
  }

  const setupRenderEffect = (instance, container) => {
    const subTree = instance.render();
    // patch(subTree, container);
  }

  function mountComponent(vnode: any, container) {
    // 1、给组件创造一个基础组件实例 
    const instance = createComponentInstance(vnode);
  
    // 2、给组件的实例进行赋值
    setupComponent(instance);
    // 3、调用render方法实现组件的渲染逻辑（首次渲染即需要render函数中所有依赖的响应式对象 =>依赖收集）
    setupRenderEffect(instance, container);
  }

  const processComponent = (vnode, container) => {
    mountComponent(vnode, container);
  }

  const render = (vnode, container) => {
    processComponent(vnode, container);
  };
  return {
    render,
    createApp: createAppAPI(render),
  }
}

