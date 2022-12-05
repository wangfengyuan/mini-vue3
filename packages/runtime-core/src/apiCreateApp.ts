import { createVNode } from "./vnode";

export function createAppAPI(render) {
  return (rootComponent, rootProps) => {
    let isMounted = false;
    const app = {
      mount(container) {
        if (!isMounted) {
          // 初始化渲染
          // 创建vnode
          const vnode = createVNode(rootComponent, rootProps);
          //2. 挂载的核心就是根据传入的组件把它渲染成组件的虚拟节点，然后再将虚拟节点渲染到容器中
          render(vnode, container);
          isMounted = true;
        }
      },
      use() {},
      directive() {},
      component() {},
      unmount() {},
      install() {},
      mixin() {},
      provide() {},
    }
    return app;
  }
}