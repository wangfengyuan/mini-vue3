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
      // 存储寻找过程中遇到的最大索引值，如果新节点在对应的旧节点的索引比如，0，1，2，升序的代表顺序不需要移动
      // 否则比如，2，1，0，需要移动，说明对应1、0索引的新节点，在旧节点中位于2的前面，但是新节点时位于2的后面，因此这两个需要移动
      let lastIndex = 0;
      for (let i = 0; i < newChildren.length; i++) {
        const newVnode = newChildren[i];
        // 代表是否在旧子节点中找到了可复用的节点
        let find = false;
        for (let j = 0; j < oldChildren.length; j++) {
          const oldVNode = oldChildren[j];
          // 如果找到了相同key的节点，说明可以复用，使用patch更新
          if (newVnode.key === oldVNode.key) {
            // 如果找到，赋值find true
            find = true;
            patch(oldVNode, newVnode, container);
            if (j < lastIndex) {
              // 说明该节点对应的真实DOM需要移动
              // 获取newChildren前一个vnode,即preVNode
              const preVNode = newChildren[i - 1];
              // 如果preVNode不存在，说明当前newVNode是第一个节点，不需要移动
              if (preVNode) {
                // 由于要将newVNode对应的真实DOM移动到preVNode对应的真实DOM后面
                // 所以先获取preVNode对应的下一个兄弟节点
                const anchor = preVNode.el.nextSibling;
                // 调用insert将newVNode对应的真实DOM插入到anchor后面
                insert(newVnode.el, container, anchor);
              }
            } else {
              // 如果大于lastIndex则更新
              lastIndex = j;
            }
            break;
          }
        }
        // 如果代码运行到这，find仍然为false，说明没有找到相同key的节点，需要新建
        if (!find) {
          const preVNode = newChildren[i - 1];
          let anchor = null;
          if (preVNode) {
            anchor = preVNode.el.nextSibling;
          } else {
            // 没有preVNode说明第一个元素就是需要新增的元素
            anchor = container.firstChild;
          }
          // 挂载
          patch(null, newVnode, container, anchor);
        }
      }
      // 遍历旧的节点
      for (let i = 0; i < oldChildren.length; i++) {
        const oldVNode = oldChildren[i]
        // 拿着旧 VNode 去新 children 中寻找相同的节点
        const has = newChildren.find(
          vnode => vnode.key === oldVNode.key
        )
        if (!has) {
          // 如果没有找到相同的节点，则移除
          unmount(oldVNode)
        }
      }
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
    { type: 'p', children: 'hello', key: 3 }
  ]
}
renderer.render(oldVnode, document.querySelector('#app'))

const newVnode = {
  type: 'div',
  children: [
    { type: 'p', children: '1', key: 1 },
    { type: 'p', children: '2', key: 2 }
  ]
}

setTimeout(() => {
  console.log('update')
  renderer.render(newVnode, document.querySelector('#app'))
}, 400);