//更新浏览器标签属性的操作

import { patchAttr } from "./modules/attrs"
import { patchClass } from "./modules/class"
import { patchEvent } from "./modules/events"
import { patchDOMProp } from "./modules/props"

//diff算法要用到来对比标签的属性
/**
 * 
 * @param el 哪个el上的属性
 * @param key patch的属性key
 * @param prevValue 旧值
 * @param nextValue 新值
 */
export const patchProp = (el, key, preValue, nextValue) => {
  if (/^on/.test(key)) {
    patchEvent(el, key, nextValue);
  } else if (key === 'class') {
    // 对class进行特殊处理，因为className效率最高,相比较setAttribute/classList
    patchClass(el, nextValue)
  } else if (shouldSetAsProps(el, key, nextValue)) {
    patchDOMProp(el, key, nextValue);
  } else {
    // 如果不是DOM属性, 则使用setAttribute设置属性
    //其他属性
    //setAttribute() removeAttribute()
    patchAttr(el, key, nextValue);
  }
}

function shouldSetAsProps(el, key, value) {
  // 特殊处理,对于下面这种el.form是只读的，只能通过setAttribute设置
  // <form id="form1"></form> <input form="form1" />
  if (key === 'form' && el.tagName === 'INPUT') return false;
  // 降级使用in
  return key in el;
}