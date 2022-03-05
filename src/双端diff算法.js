// 文本节点和注释节点没有对应的type标识, 主动生成一个
const Text = Symbol();
const Comment = Symbol();
const Fragment = Symbol();

function createRenderer(options) {
  // 通过options得到操作DOM的方法
  const {
    createElement,
    insert,
    setElementText,
    patchProps,
    createText,
    setText,
  } = options;

  function unmount(vnode) {
    // 在卸载时，如果卸载类型为Fragment，则需要卸载children
    if (vnode.type === Fragment) {
      vnode.children.forEach(c => unmount(c));
      return;
    }
    // 根据vnode获取要卸载的真实dom元素
    const el = vnode.el;
    // 获取el的父元素
    const parent = el.parentNode;
    if (parent) parent.removeChild(el);
  }

  function mountElement(vnode, container, anchor) {
    const el = vnode.el = createElement(vnode.type);
    // 如果子节点为字符串，代表元素具有文本节点
    if (typeof vnode.children === 'string') {
      // setElementText设置元素文本
      setElementText(el, vnode.children);
    } else if (Array.isArray(vnode.children)) {
      // 如果是数组，递归挂载子节点
      vnode.children.forEach(child => {
        // 这里不能使用mountElement， 因为child不一定是元素类型节点，需要在patch判断
        patch(null, child, el);
      })
    }
    // 处理props
    if (vnode.props) {
      for (const key in vnode.props) {
        // 调用patchProps方法，更新props
        patchProps(el, key, null, vnode.props[key]);
      }
    }
    // 调用insert插入容器
    insert(el, container, anchor);
  }

  function patchElement(n1, n2) {
    // patch时 新vnode的el引用旧vnode的el，这样就可以更新el
    const el = n2.el = n1.el;
    const oldProps = n1.props;
    const newProps = n2.props;
    // 第一步更新props
    for (const key in newProps) {
      if (oldProps[key] !== newProps[key]) {
        patchProps(el, key, oldProps[key], newProps[key]);
      }
    }
    for (const key in oldProps) {
      if (!(key in newProps)) {
        patchProps(el, key, oldProps[key], null);
      }
    }
    // 第二步更新children
    patchChildren(n1, n2, el);
  }

  function patchKeyedChildren(n1, n2, container) {
    const oldChildren = n1.children;
    const newChildren = n2.children;
    // 四个索引，分别指向新旧节点的头尾
    let oldStartIndex = 0;
    let oldEndIndex = oldChildren.length - 1;
    let newStartIndex = 0;
    let newEndIndex = newChildren.length - 1;
    // 四个索引指向的vnode节点
    let oldStartVnode = oldChildren[oldStartIndex];
    let oldEndVnode = oldChildren[oldEndIndex];
    let newStartVnode = newChildren[newStartIndex];
    let newEndVnode = newChildren[newEndIndex];

    while(newStartIndex <= newEndIndex && oldStartIndex <= oldEndIndex) {
      // 因为移动后有置为undefined的情况，所以需要判断是否为undefined, 如果是undefined，则跳过
      if (!oldStartVnode) {
        oldStartVnode = oldChildren[++oldStartIndex];
      } else if (!oldEndVnode) {
        oldEndVnode = oldChildren[--oldEndIndex];
      } else if (oldStartVnode.key === newStartVnode.key) {
        // 第一步： oldStartVnode和newStartVnode比较
        patch(oldStartVnode, newStartVnode, container);
        oldStartVnode = oldChildren[++oldStartIndex];
        newStartVnode = newChildren[++newStartIndex];
      } else if (oldEndVnode.key === newEndVnode.key) {
        // 第二步： oldEndVnode和newEndVnode比较
        patch(oldEndVnode, newEndVnode, container);
        oldEndVnode = oldChildren[--oldEndIndex];
        newEndVnode = newChildren[--newEndIndex];
      } else if (oldStartVnode.key === newEndVnode.key) {
        // 第三步： oldStartVnode和newEndVnode比较
        patch(oldStartVnode, newEndVnode, container);
        // 将旧的子节点头部移动到旧的子节点的尾部节点的后面, 这里anchor选择oldEndVnode的下一个兄弟节点
        insert(oldStartVnode.el, container, oldEndVnode.el.nextSibling);
        // 更新索引
        oldStartVnode = oldChildren[++oldStartIndex];
        newEndVnode = newChildren[--newEndIndex];
      } else if (oldEndVnode.key === newStartVnode.key) {
        // 第四步： oldEndVnode和newStartVnode比较
        // oldend对应newstart,说明需要将位置移动到newStart前面
        patch(oldEndVnode, newStartVnode, container);
        insert(oldEndVnode.el, container, oldStartVnode.el);
        oldEndVnode = oldChildren[--oldEndIndex];
        newStartVnode = newChildren[++newStartIndex];
      } else {
        // 四次比较均不相同
        // 遍历旧的子节点，视图寻找和newStartVnode拥有相同key的节点
        const idxInOld = oldChildren.findIndex(vnode => vnode.key === newStartVnode.key);
        // 如果idxInOld 大于 -1，说明找到了，需要将对应的真实DOM移动到头部
        if (idxInOld > -1) {
          // 如果找到了，则更新
          const vnodeToMove = oldChildren[idxInOld];
          patch(vnodeToMove, newStartVnode, container);
          insert(vnodeToMove.el, container, oldStartVnode.el);
          // 因为已经移动到了其他位置，需要改为undefined
          oldChildren[idxInOld] = undefined;
          newStartVnode = newChildren[++newStartIndex];
        }
      }
    }
  }

  function patchChildren(n1, n2, container) {
    const oldChildren = n1.children;
    const newChildren = n2.children;
    // 如果新旧节点都是字符串，则更新文本
    if (typeof newChildren === 'string') {
      // 旧子节点为一组时逐个卸载
      if (Array.isArray(oldChildren)) {
        oldChildren.forEach(c => unmount(c));
      }
      // 将新的文本内容设置给容器元素
      setElementText(container, newChildren);
    } else if (Array.isArray(newChildren)) {
      patchKeyedChildren(n1, n2, container);
    } else {
      // 代码运行到这里说明新子节点不存在
      if (Array.isArray(oldChildren)) {
        // 将旧子节点逐个卸载
        oldChildren.forEach(c => unmount(c));
      } else if (typeof oldChildren === 'string') {
        // 将容器清空
        setElementText(container, '');
      } 
      // 如果没有旧子节点，什么也不做
    }
  }

  // n1代表旧node, n2代表新node
  function patch(n1, n2, container, anchor) {
    // 如果n1和n2类型不同
    if (n1 && n1.type !== n2.type) {
      // 卸载n1
      unmount(n1);
      n1 = null;
    }
    // 代码运行到这里说明n1和n2类型相同
    const { type } = n2;
    // 如果n2是元素节点
    if (typeof type === 'string') {
      // 如果n1不存在，意味着挂载，则调用mountElement完成初次挂载
      if (!n1) {
        mountElement(n2, container, anchor)
      } else {
        // n1存在，意味着打补丁，暂时忽略
        patchElement(n1, n2);
      }
    } else if (type === Text) {
      // 如果新vnode类型为Text说明是文本节点
      if (!n1) {
        // 挂载
        const el = n2.el = createText(n2.children);
        insert(el, container, anchor);
      } else {
        const el = n2.el = n1.el;
        if (n2.children !== n1.children) {
          // 如果文本节点内容不一致，setText更新内容
          setText(el, n2.children);
        }
      }
    } else if (type === Fragment) {
      // 如果新vnode类型为Fragment， 只需要处理children即可
      if (!n1) {
        // 挂载
        n2.children.forEach(c => patch(null, c, container));
      } else {
        // 旧vnode存在，只需要更新Fragment的children即可
        patchChildren(n1, n2, container);
      }
    } else if (typeof type === 'object') {
      // 如果n2 type为对象，则描述的是组件
    } else if (typeof type === 'xx') {
      // c处理其他类型的vnode
    }
  }

  function render(vnode, container) {
    if (vnode) {
      // 新vnode存在，则调用patch完成更新
      patch(container._vnode, vnode, container);
    } else {
      if (container._vnode) {
        // 新vnode不存在，而旧vnode存在，则清空
        // container.innerHtml = '';
        // 不能使用innerHtml, 因为组件的unmounted等方法需要调用，并且innerHtml时绑定的事件不会移除
        unmount(container._vnode);
      }
    }
    // 把 vnode 存储到 container._vnode 下，即后续渲染中的旧 vnode
    container._vnode = vnode
  }
  return {
    render,
  }
}


function shouldSetAsProps(el, key, value) {
  // 特殊处理,对于下面这种el.form是只读的，只能通过setAttribute设置
  // <form id="form1"></form> <input form="form1" />
  if (key === 'form' && el.tagName === 'INPUT') return false;
  return key in el;
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
  },
  createText(text) {
    return document.createTextNode(text);
  },
  setText(el, text) {
    el.nodeValue = text;
  },
  patchProps(el, key, preValue, nextValue) {
    if (/^on/.test(key)) {
      // el._vei为一个对象，存储事件名称到事件处理函数的映射
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
      }
    } else if (key === 'class') {
      // 对class进行特殊处理，因为className效率最高
      el.className = nextValue;
    } else if (shouldSetAsProps(el, key, nextValue)) {
      // 判断key是否存在对应的DOM属性
      // 获取该DOM属性的类型
      const type = typeof el[key];
      // 如果是布尔类型，并且value是空字符串，则将值矫正为true 比如disabled=""
      if (type === 'boolean' && nextValue === '') {
        el[key] = true;
      } else {
        el[key] = nextValue;
      }
    } else {
      // 如果不是DOM属性, 则使用setAttribute设置属性
      el.setAttribute(key, nextValue);
    }
  }
})

const oldVnode = {
  type: 'div',
  children: [
    { type: 'p', children: '1', key: 1 },
    { type: 'p', children: '2', key: 2 },
    { type: 'p', children: '3', key: 3 },
    { type: 'p', children: '4', key: 4 }
  ]
}
renderer.render(oldVnode, document.querySelector('#app'))

const newVnode = {
  type: 'div',
  children: [
    { type: 'p', children: '2', key: 2 },
    { type: 'p', children: '4', key: 4 },
    { type: 'p', children: '1', key: 1 },
    { type: 'p', children: '3', key: 3 }
  ]
}

setTimeout(() => {
  console.log('update')
  renderer.render(newVnode, document.querySelector('#app'))
}, 400);