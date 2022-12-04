export function patchEvent(el, key, nextValue) {
  // el._vei vue event invoker首字母缩写，为一个对象，存储事件名称到事件处理函数的映射, 对于相同事件,值不同的情况直接从缓存中取即可
  //例如 <div onclick="()=>{console.log('aaaaa')}"> </div> <div onclick="()=>{console.log('bbb')}"> </div> 无需频繁的addEventListener() removeEventListener() 
  let invokers = el._vei || (el._vei = {});
  // 获取为该元素伪造的事件处理函数invoker
  let invoker = invokers[key];
  // 根据属性名获取事件名称，例如onClick ---> click
  const name = key.slice(2).toLowerCase();
  if (nextValue) {
    if (!invoker) {
      // 如果invoker不存在，则创建一个伪造的invoker并缓存到el._vei
      invoker = el._vei[key] = function (e) {
        // e.timestamp是事件发生的时间
        if (e.timeStamp < invoker.attached) return;
        if (Array.isArray(invoker.value)) {
          /**
           * 处理如下结构
           * props： {
           *  onClick: [fn1, fn2, fn3]}
           */
          invoker.value.forEach(fn => fn(e));
        } else {
          // 调用真正的事件处理函数
          invoker.value(e);
        }
      };
      // 真正的事件处理函数赋值给invoker.value
      invoker.value = nextValue;
      // 添加invoker.attached属性，存储事件绑定时间，需要屏蔽所有绑定时间晚于事件触发时间的事件执行
      invoker.attached = performance.now();
      el.addEventListener(name, invoker);
    } else {
      // 如果invoker存在，则更新invoker.value,更新时省去了removeEventListener和addEventListener
      invoker.value = nextValue;
    }
  } else if (invoker) {
    el.removeEventListener(name, invoker);
    invoker[key] = null;
  }
}