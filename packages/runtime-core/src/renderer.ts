import { ShapeFlags } from '@mini-vue3/shared';
import { createAppAPI } from './apiCreateApp'
import { createComponentInstance, setupComponent } from './component';

export function createRenderer(renderOptions) {

  const {
    insert: hostInsert,
    createElement: hostCreateElement,
    setElementText: hostSetElementText,
  } = renderOptions;

  const patch = (n1, n2, container) => {
    const { type, shapeFlag } = n2;
    if (shapeFlag & ShapeFlags.COMPONENT) {
      console.log('patch组件-------');
      processComponent(n1, n2, container);
    } else if (shapeFlag & ShapeFlags.ELEMENT) {
      console.log('patch元素-------')
      processElement(n1, n2, container);
    }
  }

  const setupRenderEffect = (instance, container) => {
    console.log('初始化调用render');
    // 初次挂载 会调用render方法
    // 渲染页面的时候响应式对象会取值,取值的时候会进行依赖收集 收集对应的effect
    // 当渲染完成之后，如果数据发生了改变会再次执行当前方法
    const subTree = instance.render.call(instance.proxy, instance.proxy);
    instance.subTree = subTree;
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
    const { type, children, shapeFlag } = n2;
    const el = n2.el = hostCreateElement(type as string);
    if (typeof children === 'string' || typeof children === 'number') {
      hostSetElementText(el, children);
    } else if (Array.isArray(children)) {
      mountChildren(children, el);
    }
    hostInsert(el, container);
  }

  const mountChildren = (children, container) => {
    children.forEach(v => {
      patch(null, v, container);
    });
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
