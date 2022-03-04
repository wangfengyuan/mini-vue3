function createRenderer(option) {
  // 通过options得到操作DOM的方法
  const {
    createElement,
    insert,
    setElementText
  } = options;

  function mountElment(vnode, container) {
    const el = createElement(vnode.tag);
    // 如果子节点为字符串，代表元素具有文本节点
    if (typeof vnode.children === 'string') {
      // setElementText设置元素文本
      setElementText(el, vnode.children);
    }
    // 调用insert插入容器
    insert(el, container);
  }

  // n1代表旧node, n2代表新node
  function patch(n1, n2, container) {
    // 如果n1不存在，意味着挂载，则调用mountElment完成初次挂载
    if (!n1) {
      mountElement(n2, container)
    } else {
      // n1存在，意味着打补丁，暂时忽略
    }
  }

  function render(vnode, container) {
    if (vnode) {
      // 新vnode存在，则调用patch完成更新
      patch(container._vnode, vnode, container);
    } else {
      if (container._vnode) {
        // 新vnode不存在，而旧vnode存在，则清空
        container.innerHtml = '';
      }
    }
    // 把 vnode 存储到 container._vnode 下，即后续渲染中的旧 vnode
    container._vnode = vnode
  }
  return {
    render,
  }
}


const renderer = createRenderer({
  insert(el, parent, anchor) {
    parent.insertBefore(el, anchor);
  },
  setElementText(el, text) {
    el.textContent = text;
  },
  createElement(tag) {
    return document.createElement(tag);
  }
})

