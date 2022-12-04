// 主要是一些与浏览器平台相关的代码（dom操作Api,属性操作的Api --->传入runtime-core），依赖runtime-core
import { extend } from '@mini-vue3/shared';
import { createRenderer } from '@mini-vue3/runtime-core'
import { nodeOps } from './nodeOps';
import { patchProp } from './patchProp';
const renderOptions = extend(nodeOps, { patchProp }) //浏览器平台渲染包含的所有api

export const createApp = (rootComponent, rootProps = null) => {
  //创建一个渲染器 返回 createApp
  const { createApp } = createRenderer(renderOptions);
  const app = createApp(rootComponent, rootProps);
  let { mount } = app; //  获取core中app的mount
  app.mount = function (container) { //重新mount
    container = renderOptions.querySelector(container)
    container.innerHTML = '' //清空根元素的children
    mount(container)
  }
  return app;
}

export * from '@mini-vue3/runtime-core';