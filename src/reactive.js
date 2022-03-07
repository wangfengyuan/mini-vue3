/**
 * 使用了WeakMap、Map和Set数据结构
 * WeakMap由 target --> Map 组成
 * Map由 key --> Set 组成
 * Set保存了所有的依赖
 */

const bucket = new WeakMap();

// 定义一个任务队列
const jobQueue = new Set();
// 使用Promise.resolve()创建一个promise实例，我们用它将一个任务添加到任务队列
const p = Promise.resolve();
// for...in 时没有确定的key，因此采用ITERATE_KEY
const ITERATE_KEY = Symbol('iterate');

// 一个标志位，用于标记当前是否有副作用正在执行
let isFlushing = false;

export function queueJob(job) {
  jobQueue.add(job);
  flushJob();
}

function flushJob() {
  // 如果队列正在刷新，则什么都不做
  if (isFlushing) return;
  // 设置为true代表正在刷新
  isFlushing = true;
  p.then(() => {
    // 将jobQueue中的任务全部执行
    jobQueue.forEach(job => job());
  }).finally(() => {
    // 设置为false代表刷新完成
    isFlushing = false;
  })

}

// 用一个全局变量存储当前正在执行的副作用effect函数
let activeEffect;

// effect栈
const effectStack = [];

function cleanup(effectFn) {
  for (let i = 0; i < effectFn.deps.length; i++) {
    // deps是effectFn引用的依赖集合
    const deps = effectFn.deps[i];
    // 将effectFn从deps依赖集合中移除
    deps.delete(effectFn);
  }
  // 最后重置effectFn.deps数组
  effectFn.deps = [];
}


export function effect(fn, options = {}) {
  const effectFn = () => {
    // 清理旧的依赖
    cleanup(effectFn);
    // 将当前正在执行的effect函数赋值给activeEffect
    activeEffect = effectFn;
    // 当前副作用函数入栈
    effectStack.push(effectFn);
    // 将fn的执行结果保存到res
    const res = fn();
    // 调用之后将当前副作用函数出站，并将activeEffect还原
    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];
    // 将res作为effectFn的返回值
    return res;
  }
  effectFn.deps = [];
  effectFn.options = options;
  // 只有非lazy的时候才执行
  if(!options.lazy) {
    effectFn();
  }
  return effectFn;
}

const data = { ok: true, text: 'hello world', foo: 1 };

function track(target, key) {
  // 当禁止追踪时直接返回
  if (!activeEffect || !shouldTrack) return;
  let depsMap = bucket.get(target);
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()));
  }
  let deps = depsMap.get(key);
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }
  deps.add(activeEffect);
  // deps是一个与当前副作用函数存在联系的依赖set集合
  // 将其添加到activeEffect.deps中
  activeEffect.deps.push(deps);
}

function trigger(target, key, type, val) {
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  // 获取key相关的依赖
  const deps = depsMap.get(key);
  // 获取ITERA_KEY相关联的依赖
  const iterateDeps = depsMap.get(ITERATE_KEY);

  // deps && deps.forEach((fn) => fn());
  // effectsToRun构建一个新的Set, 避免Set中删除又新增导致无限循环
  const effectsToRun = new Set();
  deps && deps.forEach(effectFn => {
    if (effectFn !== activeEffect) {
      effectsToRun.add(effectFn);
    }
  });

  // 如果目标是数组并且修改了数组的length属性
  if (Array.isArray(target) && key === 'length') {
    depsMap.forEach((effects, key) => {
      if (key >= val) {
        effects.forEach(effectFn => {
          if (effectFn !== activeEffect) {
            effectsToRun.add(effectFn);
          }
        })
      }
    })
  }
  // 只有操作类型是‘ADD’时，才会触发ITERA_KEY的依赖
  // 将ITERA_KEY相关联的依赖也加入到effectsToRun中
  if (type === 'ADD' || type === 'DELETE') {
    iterateDeps && iterateDeps.forEach(effectFn => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn);
      }
    });
  }
  // 
  if (type === 'ADD' && Array.isArray(target)) {
    // 去除与length相关的依赖
    const lengthDeps = depsMap.get('length');
    lengthDeps && lengthDeps.forEach(effectFn => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn);
      }
    });
  }
  effectsToRun.forEach(effectFn => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn);
    } else {
      effectFn();
    }
  });
}

const arrayInstrumentations = {};

['includes', 'indexOf', 'lastIndexOf'].forEach(method => {
  const original = Array.prototype[method];
  arrayInstrumentations[method] = function(...args) {
    // this是代理对象，先在代理中查找返回结果
    let res = original.call(this, ...args);
    if (res === false || res === -1) {
      // 如果没有找到，则在原始数组中查找
      res = original.call(this.raw, ...args);
    }
    // 返回最终结果
    return res;
  }
})

// 一个标记，代表是否进行追踪
let shouldTrack = true;

['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'].forEach(method => {
  const original = Array.prototype[method];
  arrayInstrumentations[method] = function(...args) {
    // 调用原始方法之前，禁止追踪
    shouldTrack = false;
    // push等函数默认行为
    let res = original.call(this, ...args);
    // 开启追踪
    shouldTrack = true;
    // 返回最终结果
    return res;
  }
})

function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      // 代理对象可以通过raw属性访问原始对象
      if (key === 'raw') {
        return target;
      }
      // 如果是数组并且arrayInstrumentations中有定义方法，返回arrayInstrumentations中的方法的值
      if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
        return Reflect.get(arrayInstrumentations, key, receiver);
      }
      // 添加判断，如果key的类型是Symbol,不进行追踪
      // 非只读时才建立响应联系，因为只读不能修改数据，也就不可能触发副作用执行
      if (!isReadonly && typeof key !== 'symbol') {
        track(target, key);
      }
      const res = Reflect.get(target, key, receiver);
      // 如果是浅响应，直接返回原始值
      if (isShallow) {
        return res;
      }
      // 得到原始值结果
      if (typeof res === 'object' && res !== null) {
        // 调用reactive方法，将结果转换为响应式对象
        return isReadonly ? readonly(res) : reactive(res);
      }
      return res;
    },
    set(target, key, val, receiver) {
      // 如果只读，打印警告并返回
      if (isReadonly) {
        console.warn(`${key} is readonly`);
        return true;
      }
      // 获取旧值
      const oldVal = target[key];
      // 属性不存在是新增，存在是修改
      const type = Array.isArray(target) 
        // 如果是数组，检测设置索引是否小于数组长度，如果是，则是新增，否则是修改
        ? Number(key) < target.length ? 'SET' : 'ADD'
        : Object.prototype.hasOwnProperty.call(target, key) ? 'SET' : 'ADD';
      const res = Reflect.set(target, key, val, receiver);
      // 如果target === receiver.raw，说明receive就是target的代理对象
      if (target === receiver.raw) {
        // 比较新旧值是否相等，并且都不是NaNs时才触发更新
        if (oldVal !== val && (oldVal === oldVal || val === val)) {
          // 增加type作为第三个参数，用于区分是新增还是修改
          trigger(target, key, type, val);
        }
      }
      return res;
    },
    // 拦截 in 操作符
    has(target, key) {
      track(target, key);
      return Reflect.has(target, key);
    },
    // 拦截for...in循环
    ownKeys(target) {
      track(target, Array.isArray(target) ? 'length': ITERATE_KEY);
      return Reflect.ownKeys(target);
    },
    // 拦截delete操作符
    deleteProperty(target, key) {
      // 如果只读，打印警告并返回
      if (isReadonly) {
        console.warn(`${key} is readonly`);
        return true;
      }
      // 检查被操作属性是否是对象自己的属性
      const hadKey = Object.prototype.hasOwnProperty.call(target, key);
      // 完成属性删除
      const res = Reflect.deleteProperty(target, key);
      if (res && hadKey) {
        // 只有当删除属性是自身并删除成功时才触发 
        trigger(target, key, 'DELETE');
      }
      return res;
    }
  });
}

// 存储obj到proxy关系
const reactiveMap = new Map();

export function reactive(obj) {
  const existProxy = reactiveMap.get(obj);
  // 找到了返回，之前创建过
  if (existProxy) return existProxy;
  // 创建代理对象
  const proxy = createReactive(obj);
  // 存储proxy到obj关系
  reactiveMap.set(obj, proxy);
  return proxy;
}

export function shallowReactive(obj) {
  return createReactive(obj, true);
}

function readonly(obj) {
  return createReactive(obj, false, true);
}

export function shallowReadonly(obj) {
  return createReactive(obj, true, true);
}



function computed(getter) {
  // 用value缓存上一次计算的值
  let value;
  // dirty标志是否需要重新计算，true代表意味着脏，需要重新计算
  let dirty = true;
  // 把getter作为副作用函数，创建一个lazy的effect
  const effectFn = effect(getter, {
    // 添加调度器，其中将dirty重置为true
    scheduler() {
      dirty = true;
      trigger(obj, 'value');
    },
    lazy: true,
  });
  const obj = {
    // 当读取value时执行副作用函数
    get value() {
      if (dirty) {
        value = effectFn();
        dirty = false;
      }
      track(obj, 'value');
      return value;
    }
  }
  return obj;
}

// watch接收两个参数，第一个是source响应式数据，第二个是回调函数
function watch(source, cb, options = {}) {
  let getter;
  // 如果参数source是函数，则直接把source作为getter
  if (typeof source === 'function') {
    getter = source;
  } else {
    // 否则按照原来方式递归读取source的属性
    getter = () => traverse(source);
  }
  let oldValue, newValue;
  const job = () => {
    newValue = effectFn();
    // 当source发生变化时，执行回调函数
    cb(newValue, oldValue);
    oldValue = newValue;
  }
  const effectFn = effect(
    () => getter(),
    {
      scheduler: () => {
        if (options.flush === 'post') {
          const p = Peomise.resolve();
          p.then(job);
        } else {
          job();
        }
      },
      lazy: true,
    }
  );
  if (options.immediate) {
    // 当immediate为true时，立即执行一次回调函数
    job();
  } else {
    // 手动调用一次effectFn，获取初始值
    oldValue = effectFn();
  }
} 

function traverse(value, seen = new Set()) {
  // 如果value是基本类型，或者已经读取过了，直接返回
  if (typeof value !== 'object' || value === null || seen.has(value)) return;
  // 把数据添加到seen中，代表遍历读取过了，
  seen.add(value);
  // 暂时不考虑数组结构
  for(const k in value) {
    // 对于每个属性，递归调用traverse,这样能访问到每一个属性
    traverse(value[k], seen);
  }
  return value;
}

export function ref(val) {
  // 创建包裹对象
  const wrapper = {
    value: val,
  }
  // 定义一个不可枚举属性__v_isRef，并且赋值为true
  Object.defineProperty(wrapper, '__v_isRef', {
    value: true,
  })
  return reactive(wrapper);
}

function toRef(obj, key) {
  const wrapper =  {
    get value() {
      return obj[key];
    },
    set value(val) {
      obj[key] = val
    }
  }
  Object.defineProperty(wrapper, '__v_isRef', {
    value: true,
  })
  return wrapper;
}

function toRefs(obj) {
  const ret = {};
  for (const key in obj) {
    ret[key] = toRef(obj, key);
  }
  return ret;
}

function proxyRefs(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      // 如果读取的是ref返回它的value属性值
      return value.__v_isRef ? value.value :value;
    },
    set(target, key, newValue, receiver) {
      // 通过target读取真实值
      const value = target[key];
      // 如果值是ref，则设置value属性值
      if (value && value.__v_isRef) {
        value.value = newValue;
        return true;
      }
      return Reflect.set(target, key, newValue, receiver);
    }
  })
}

// effect(() => console.log(obj.foo), {
//   scheduler: (effectFn) => {
//     // 每次调度将副作用函数添加到任务队列中
//     jobQueue.add(effectFn);
//     // 刷新队列
//     flushJob();
//   }
// });
// const effectFn = effect(() => obj.text + obj.foo, {
//   lazy: true,
// });
// const value = effectFn();
// console.log('value', value);

// const sumRes = computed(() => obj.foo + obj.bar);
// console.log('sumRes', sumRes.value);
// obj.foo = 10;
// console.log('sumRes', sumRes.value);

// effect(()=> console.log('sumRes', sumRes.value))
// obj.foo++

// watch(() => obj.foo, (newValue, oldValue) => console.log('数据变化了', newValue, oldValue), {
//   immediate: true,
// });
// obj.foo++;

// const testobj = { foo: 1 };
// console.log(Reflect.get(testobj, 'foo', { foo: 10 }));

// effect(() => console.log('foo' in obj));
// obj.foo = 2;
// 测试delete
// effect(() => {
//   for (const key in obj) {
//     console.log(key);
//   }
// });
// delete obj.foo;

// 测试原型链
// const obj = {}
// const proto = { bar: 1 };
// const child = reactive(obj);
// const parent = reactive(proto);
// // 使用parent作为child的原型
// Object.setPrototypeOf(child, parent);
// effect(() => console.log(child.bar));
// console.log(child.raw === obj);
// child.bar = 2;

//测试浅响应
// const obj = shallowReactive({ foo: { bar: 1 } });
// effect(() => console.log(obj.foo.bar));
// obj.foo.bar = 5;

// 测试只读
// const obj = shallowReadonly({ foo: { bar: 1 } });
// effect(() => console.log(obj.foo));
// obj.foo.bar = 5;

// 测试数组
// const arr = reactive([1, 2, 3]);
// effect(() => console.log(arr[1]));
// arr.length = 2;

// const arr = reactive([1, 2, 3]);
// effect(() => {
//   for(const key in arr) {
//     console.log(key);
//   }
// });
// arr[1] = 5;
// arr.length = 2;

// const arr = [1, 2, 3];

// arr[Symbol.iterator] = function() {
//   const target = this;
//   const len = target.length;
//   let index = 0;
//   return {
//     next() {
//       return {
//         value: index < len ? target[index] : undefined,
//         done: index++ >= len
//       }
//     }
//   }
// }

// const arr = reactive([1, 2, 3, 4, 5])

// effect(() => {
//   for (const val of arr.values()) {
//     console.log(val)
//   }
// })

// arr[1] = 'bar'
// arr.length = 1
// const obj = {}
// const arr = reactive([obj]);
// effect(() => console.log(arr.indexOf(obj)))

// const arr = reactive([]);
// effect(() => arr.push(1));
// effect(() => arr.push(1));

const obj = reactive({ foo: 1, bar: 2});
const newObj = proxyRefs({...toRefs(obj)});

console.log(newObj.foo);
