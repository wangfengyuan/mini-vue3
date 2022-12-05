import { hasOwn } from "@mini-vue3/shared"

export const PublicInstanceProxyHandlers = {
  get({ _: instance }, key) {
    const { setupState, props, data } = instance;
    //如果在render函数中使用proxy.key调用某个setupState, props
      // 根据当前的key，断是否在setupState中还是data/props中，如果在就直接返回key对应的setupState或data/props
    if (hasOwn(setupState, key)) {
      return setupState[key];
    } else if (hasOwn(data, key)) {
      return data[key]
    } else if (hasOwn(props, key)) {
      return props[key]
    } else {
      console.error('没找到当前key', key)
    }
  }
}