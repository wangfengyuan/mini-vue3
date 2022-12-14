// 文本节点和注释节点没有对应的type标识, 主动生成一个
import lis from './lis';
import { ref, reactive, queueJob, shallowReactive, shallowReadonly, effect } from './reactive';
const Text = Symbol();
const Comment = Symbol();
const Fragment = Symbol();
// 全局变量，存储当前正在实例化的组价实例
let currentInstance = null;

function setCurrentInstance(instance) {
  currentInstance = instance;
}


function onMounted(fn) {
  if (currentInstance) {
    currentInstance.mounted.push(fn);
  } else {
    console.error('onMounted只能在setup函数中调用');
  }
}

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
    } else if (typeof vnode.type === 'object') {
      // 组件卸载，本质上是卸载组件所渲染的内容即subTree
      unmount(vnode.component.subTree);
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
    let j = 0;
    let oldVNode = oldChildren[j];
    let newVNode = newChildren[j];
    // 处理相同的前置节点
    while(oldVNode.key === newVNode.key) {
      patch(oldVNode, newVNode, container);
      // 更新索引j
      j++;
      oldVNode = oldChildren[j];
      newVNode = newChildren[j];
    }

    // 处理相同的后置节点
    let oldEnd = oldChildren.length - 1;
    let newEnd = newChildren.length - 1;
    oldVNode = oldChildren[oldEnd];
    newVNode = newChildren[newEnd];

    while(oldVNode.key === newVNode.key) {
      patch(oldVNode, newVNode, container);
      oldEnd--;
      newEnd--;
      oldVNode = oldChildren[oldEnd];
      newVNode = newChildren[newEnd];
    }

    // 通过j、newEnd和oldEnd的关系得到是否需要新增和删除
    // 预处理完后如果满足下面条件，则j-->newEnd之间的节点需要插入
    if (j > oldEnd && j <= newEnd) {
      const anchorIndex = newEnd + 1;
      const anchor = anchorIndex < newChildren.length ? newChildren[anchorIndex].el: null;
      while(j <= newEnd) {
        patch(null, newChildren[j++], container, anchor);
      }
    } else if (j > newEnd && j <= oldEnd) {
      // j-->oldEnd之间的节点需要删除
      while(j <= oldEnd) {
        unmount(oldChildren[j++]);
      }
    } else {
      // 处理非理想情况
      // 构造source数组，长度为新的一组子节点中剩余未处理的数量
      const count = newEnd - j + 1;
      const source = new Array(count);
      source.fill(-1);
      // 接下来填充source, 对应值为该节点在oldChildren中的索引
      const oldStart = j;
      const newStart = j;
      // 新增两个变量 moved 和 pos
      let moved = false;
      let pos = 0;
      // 新增patched变量代表更新过的数量
      let patched = 0;
      // 构建索引表, 建立节点key --> 位于新节点中的索引的映射
      const keyIndex = {};
      for (let i = newStart; i <= newEnd; i++) {
        keyIndex[newChildren[i].key] = i;
      }
      for (let i = oldStart; i <= oldEnd; i++) {
        const oldVNode = oldChildren[i];
        if (patched <= count) {
          // 通过索引表快速找到新的一组子节点中具有相同key值的节点位置
          const k = keyIndex[oldVNode.key];
          if (typeof k !== 'undefined') {
            // 找到了，进行patch并更新source
            newVNode = newChildren[k];
            patch(oldVNode, newVNode, container);
            source[k - newStart] = i;
            // 每更新一个节点，patched+1
            patched++;
            // 判断节点是否需要移动
            // 和简单diff算法一样，如果pos呈现递增趋势则不需要移动，否则需要
            if (k < pos) {
              moved = true;
            } else {
              pos = k;
            }
          } else {
            // 没找到可复用的，卸载
            unmount(oldVNode);
          }
        } else {
          // 如果更新过的节点数量大于需要更新的数量，则卸载多于节点
          unmount(oldVNode);
        }
      }

      if (moved) {
        // 需要移动
        // 计算最长递增子序列，返回对应的在数组中的索引，比如[2, 3, 1, -1],返回seq为[0, 1]
        // 含义是：在新的一组子节点中，索引值0和1对应的这两个子节点在更新前后顺序没有发生变化
        // 换句话说，索引值为0和1的节点不需要移动
        const seq = lis(source);
        // 为了完成节点的移动，创建两个索引值i和s
        // 索引i指向新的一组子节点的最后一个元素， 索引s指向最长递增子序列的最后一个元素
        let s = seq.length - 1;
        let i = count - 1;
        for(i; i >= 0; i--) {
          if (source[i] === -1) {
            // 如果source[i]为-1，则说明是全新节点，需要挂载
            const pos = i + newStart;
            const newVNode = newChildren[pos];
            const nextPos = pos + 1;
            const anchor = nextPos < newChildren.length ? newChildren[nextPos].el: null;
            // 挂载
            patch(null, newVNode, container, anchor);      
          } else if (i !== seq[s]) {
            // 如果i和s不相等，则需要移动
            const pos = i + newStart;
            const newVNode = newChildren[pos];
            const nextPos = pos + 1;
            const anchor = nextPos < newChildren.length ? newChildren[nextPos].el: null;
            insert(newVNode.el, container, anchor);
          } else {
            // i === seq[s] 说明该位置的节点不需要移动
            s--;
          }
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
    } else if (typeof type === 'object' || typeof type === 'function') {
      // 如果n2 type为对象，则描述的是组件, 如果是函数，则是函数式组件
      if (!n1) {
        // 挂载组件
        mountComponent(n2, container, anchor);
      } else {
        patchComponent(n1, n2, anchor);
      }
    } else if (typeof type === 'xx') {
      // c处理其他类型的vnode
    }
  }

  function defineAsyncComponent(options) {
    // options可以是配置项，也可以只是加载器函数
    if (typeof options === 'function') {
      options = { loader: options };
    }
    const { loader } = options;
    // 存储异步加载的组件
    let InnerComp = null;

    // 记录重试次数
    let retries = 0;
    // 封装load函数用来加载异步组件
    function load() {
      return loader()
        .catch(err => {
          // 如果用户指定了onError，则调用onError
          if (options.onError) {
            // 返回一个新的promise， 并将控制权交给用户
            return new Promise((resolve, reject) => {
              // 重试
              const retry = () => {
                resolve(load());
                retries++;
              }
              // 失败
              const fail = () => reject(err);
              // 作为onerror的回调函数的参数，让用户决定下一步怎么做
              options.onError(retry, fail, retries);
            })
          }
          throw err;
        })
    }
    // 返回一个包裹组件
    return {
      name: 'AsyncComponentWrapper',
      setup() {
        // 异步组件是否加载成功
        const loaded = ref(false);
        // 定义error对象
        const error = shallowRef(null);
        // 代表是否正在加载
        const loading = ref(true);
        const loadingTimer = null;
        // 如果有 delay 选项，时间到后将loading.value设置为true
        if (options.delay) {
          loadingTimer = setTimeout(() => {
            loading.value = true;
          }, options.delay)
        } else {
          // 如果没有delay，则立即设置loading.value为true
          loading.value = true;
        }
        // 执行加载器函数，返回promise实例，加载成功后赋值给InnerComp，并设置loaded为true
        load()
          .then(c => {
            InnerComp = c;
            loaded.value = true;
          })
          .catch(e => error.value = e) // catch捕获加载中的错误
          .finally(() => {
            loading.value = false;
            // 加载完毕后，无论成功与否清除延时定时器
            setTimeout(loadingTimer);
          });
        let timer = null;
        if (options.timeout) {
          // 如果设置了超时时间，则设置定时器
          timer = setTimeout(() => {
            // 创建一个错误
            const err = new Error('组件加载超时');
            error.value = err;
          }, options.timeout)
        }
        // 包装组件被卸载时清除定时器
        onMounted(() => clearTimeout(timer));
        // 占位内容
        const placeholder = { type: Text, children: '' };
        return () => {
          // 如果加载成功则渲染组件，否则渲染一个占位内容
          if (loaded.value) {
            return { type: InnerComp };
          } else if (error.value && options.errorComponent) {
            // 如果发生错误并且指定了ErrorComponent，则渲染ErrorComponent
            return { type: options.errorComponent, props: { error: error.value } };
          } else if (loading.value && options.loadingComponent) {
            // 如果正在加载并且指定了LoadingComponent，则渲染LoadingComponent
            return { type: options.loadingComponent };
          } else {
            return placeholder;
          }
        }
      }
    }
  }

  function mountComponent(vnode, container, anchor) {
    // 检查是否是函数式组件
    const isFunctional = typeof vnode.type === 'function';
    // 通过vnode.type获取选项对象
    let componentOptions = vnode.type;
    if (isFunctional) {
      // 如果是函数式组件，将vnode.type作为渲染函数，vnode.type.props作为props选项定义即可
      componentOptions = {
        render: vnode.type,
        props: vnode.type.props
      }
    }
    // 从组件选项对象中取出props即propsOption
    let { setup, render, data, beforeCreate, created, beforeMount, mounted, beforeUpdate, updated, props: propsOption } = componentOptions;

    // 调用beforeCreate
    beforeCreate && beforeCreate();

    // 使用reactive将data返回值包裹成响应式
    const state = data ? reactive(data()) : null;
    // 调用resolveProps解析出最终的props数据与attrs数据
    const [props, attrs] = resolveProps(propsOption, vnode.props);

    // 使用编译好的children作为slots对象
    const slots = vnode.children || {};

    // 定义组件实例
    const instance = {
      // 组件自身状态
      state,
      // 组件props包装成shallowReactive
      props: shallowReactive(props),
      // 是否挂载
      isMounted: false,
      // 组件所渲染的内容，即子树subTree
      subTree: null,
      // 插槽添加到组件实例
      slots,
      // 添加mounted数组，存储通过onMounted挂载的回调函数
      mounted: [],
    }

    /**
     * emit函数
     * @param {*} event 事件名称
     * @param  {...any} payload 参数
     */
    function emit(event, ...payload) {
      // 处理事件名称 change --> onChange
      const eventName = `on${event[0].toUpperCase()}${event.slice(1)}`;
      // 去props中查找对应的事件
      const handler = instance.props[eventName];
      if (handler) {
        handler(...payload);
      } else {
        console.error('事件不存在');
      }
    }
    const setupContext = { attrs, emit, slots };
    
    // 在调用setup之前，先把组件实例挂载到currentInstance上
    setCurrentInstance(instance);

    // 调用setup函数,将只读版本的props作为第一个参数，避免用户修改props值，setupContext作为第二个参数
    const setupResult = setup ? setup(shallowReadonly(instance.props), setupContext) : null;

    // setup执行完成后，清空currentInstance
    setCurrentInstance(null); 


    // setupState存储由setup返回的值
    let setupState = null;
    // 处理setup两种情况
    if (typeof setupResult === 'function') {
      // 如果setup返回的是函数，作为渲染函数
      if (render) console.error('setup返回函数，render选项将被忽略'); 
      render = setupResult;
    } else {
      // 不是函数，将数据赋值给setupState
      setupState = setupResult;
    }
    // 将组件实例设置到vnode上
    vnode.component = instance;

    // 创建渲染上下文，本质上是组件实例的代理
    const renderContext =  new Proxy(instance, {
      get(t, k, r) {
        // 取得组件自身状态和props数据
        const { props, state, slots } = t;
        // 访问$slots时返回组件实例上的slots
        if (k === '$slots') return slots;
        // 先尝试读取自身状态
        if (state && k in state) {
          return state[k];
        } else if (k in props) { // 再尝试读取props
          return props[k]
        } else if (setupState && k in setupState) { // 最后尝试读取setupState
          return setupState[k];
        } else {
          console.error('要读取的数据没有找到', k);
        }
      },
      set(t, k, v, r) {
        const { props, state } = t;
        if (state && k in state) {
          state[k] = v;
        } else if (k in props) { // 再尝试读取props
          props[k] = v;
        } else if (setupState && k in setupState) { // 最后尝试读取setupState
          setupState[k] = v;
        } else {
          console.error('要设置的数据没有找到', k);
        }
      }
    });

    // 这里调用created
    created && created.call(renderContext);

    // 执行渲染
    effect(() => {
      // 获取子树
      const subTree = render.call(renderContext, renderContext);
      // 检查是否挂载
      if (!instance.isMounted) {
        // 这里调用beforeMount
        beforeMount && beforeMount();
        // 初次挂载
        patch(null, subTree, container, anchor);
        // 重点，挂载完后设置isMounted为true
        instance.isMounted = true;

        // 这里调用mounted
        mounted && mounted.call(state);
        // 这里调用setup中onMounted注册的函数
        instance.mounted.forEach(fn => fn());
      } else {
        // 这里调用beforeUpdate
        beforeUpdate && beforeUpdate.call(renderContext);
        // 下一次更新时instance.isMounted = true; instance.subTree为上一次的vnode
        patch(instance.subTree, subTree, container, anchor);
        // 这里调用updated
        updated && updated.call(renderContext);
      }
      // 更新subTree
      instance.subTree = subTree;
    }, {
      scheduler: queueJob
    })
  }

  function patchComponent(n1, n2, anchor) {
    // 组件vnode为下面结构
    // {
    //   type: Component,
    //   props: {},
    //   component: {
    //     state,
    //     props,
    //     isMounted: true,
    //     subTree: ...,
    //   },
    // }
    // 获取组件实例，即n1.component,同时让新的组件虚拟节点n2.component指向它
    const instance = n2.component = n1.component;
    // 获取当前props数据, 这里的props值是子组件上次解析后得到的具体值
    const { props } = instance;
    // 调用hasPropsChanged检查是否有props更新,没有变化则不需要更新
    if (hasPropsChanged(n1.props, n2.props)) {
      // 调用resolveProps重新获取props
      const [nextProps] = resolveProps(n2.type.props, n2.props); // nextProps是这次解析后子组件新的具体值
      // 更新props
      for (const k in nextProps) {
        props[k] = nextProps[k];
      }
      // 剔除不存在的props
      for (const k in props) {
        if (!(k in nextProps)) delete props[k] 
      }
    }
  }

  function hasPropsChanged(prevProps, nextProps) {
    const nextKeys = Object.keys(nextProps);
    // 如果新旧数量变了说明有变化
    if (nextKeys.length !== Object.keys(prevProps).length) {
      return true;
    }
    for (let i = 0; i < nextKeys.length; i++) {
      const key = nextKeys[i];
      // 有不相等的props则说明有变化
      if (nextProps[key] !== prevProps[key]) return true;
    }
    return false;
  }

  function resolveProps(options, propsData) {
    const props = {};
    const attrs = {};
    // 遍历为组件传递的props数据
    for(const key in propsData) {
      // 以on开头的props,无论是否有显式的声明，都添加到props中
      if (key in options || key.startsWith('on')) {
        // 如果这个key在组件选项中有定义，则视为合法的props
        props[key] = propsData[key];
      } else {
        // 否则视为attrs
        attrs[key] = propsData[key];
      }
    } 
    return [props, attrs];
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

const MyComponent = {
  name: 'MyComponent',
  data() {
    return { foo: 1 }
  },
  props: {
    title: String,
  },
  setup(props, { emit }) {
    emit('change', 1, 2);
    onMounted(() => console.log('mounted 1'));
    onMounted(() => console.log('mounted 2'));
    const count = ref(1);
    return {
      count,
    }
  },
  render() {
    // 返回虚拟DOM
    return {
      type: Fragment,
      children: [
        {
          type: 'header',
          children: [this.$slots.header()]
        },
        {
          type: 'body',
          children: [this.$slots.body()]
        },
        {
          type: 'footer',
          children: [this.$slots.footer()]
        }
      ]
    }
  }
}

// const OldCompVNode = {
//   type: MyComponent,
//   props: {
//     title: 'a big title',
//     other: 'other',
//     onChange: (...args) => console.log(args),
//   },
//   children: {
//     header() {
//       return { type: 'h1', children: '我是标题' }
//     },
//     body() {
//       return { type: 'section', children: '我是内容' }
//     },
//     footer() {
//       return { type: 'p', children: '我是注脚' }
//     },
//   }
// }

function MyFuncComp(props) {
  return { type: 'h1', children: props.title }
}
MyFuncComp.props = {
  title: String
}

const OldCompVNode = {
  type: MyFuncComp,
  props: {
    title: 'a big title',
    other: 'other',
  },
}


renderer.render(OldCompVNode, document.querySelector('#app'));

// const NewCompVNode = {
//   type: MyComponent,
//   props: {
//     title: 'a small title',
//     other: 'other',
//   }
// }

// setTimeout(() => { 
//   renderer.render(NewCompVNode, document.querySelector('#app'));
// }, 1000);