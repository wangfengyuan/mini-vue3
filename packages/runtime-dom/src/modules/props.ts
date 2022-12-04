export function patchDOMProp(el, key, nextValue) {
  // 判断key是否存在对应的DOM属性
  // 获取该DOM属性的类型
  const type = typeof el[key];
  // 如果是布尔类型，并且value是空字符串，则将值矫正为true 比如disabled=""
  if (type === 'boolean' && nextValue === '') {
    el[key] = true;
  } else {
    el[key] = nextValue;
  }
}