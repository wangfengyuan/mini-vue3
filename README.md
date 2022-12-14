# Reactive模块

## 初体检
```
const bucket = new WeakMap();
let activeEffect;

function effect(fn) {
  activeEffect = fn;
  fn();
}

const data = { text: 'hello world' };

const obj = new Proxy(data, {
  get(target, key, receiver) {
    if (!activeEffect) return;
    let depsMap = bucket.get(target);
    if (!depsMap) {
      bucket.set(target, (depsMap = new Map()));
    }
    let deps = depsMap.get(key);
    if (!deps) {
      depsMap.set(key, (deps = new Set()));
    }
    deps.add(activeEffect);
    return Reflect.get(target, key, receiver);
  },
  set(target, key, newVal, receiver) {
      target[key] = newVal;
    const depsMap = bucket.get(target);
    if (!depsMap) return;
    const deps = depsMap.get(key);
    deps && deps.forEach((fn) => fn());
  },
});

effect(() => (document.body.innerText = obj.text));
setTimeout(() => (obj.text = 'hello vue3'), 1000);
```

## 封装track和trigger
```
function track(target, key) {
  if (!activeEffect) return;
  let depsMap = bucket.get(target);
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()));
  }
  let deps = depsMap.get(key);
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }
  deps.add(activeEffect);
}

function trigger(target, key) {
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  const deps = depsMap.get(key);
  deps && deps.forEach((fn) => fn());
}

const obj = new Proxy(data, {
  get(target, key, receiver) {
    track(target, key);
    return Reflect.get(target, key, receiver);
  },
  set(target, key, val, receiver) {
    const res = Reflect.set(target, key, val, receiver);
    trigger(target, key);
    return res;
  },
});
```

## 分支切换和cleanup
```
const data = { ok: true, text: 'hello world' };
effect(() => {
  console.log('--------');
  document.body.innerText = obj.ok ? obj.text : 'not'
});
obj.ok = false;
obj.text = 'hello vue3';
```
当obj.ok设置为false时，视图更新不在依赖obj.text，但是obj.text更新时还是触发了副作用函数执行，因此副作用函数执行之前需要清理依赖集合，再次运行时会重新收集依赖
清理需要知道哪些依赖的集合中包含当前副作用函数，因此定义一个effectFn,并添加effectFn.deps属性
```
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


function effect(fn) {
  const effectFn = () => {
    // 清理旧的依赖
    cleanup(effectFn);
    // 将当前正在执行的effect函数赋值给activeEffect
    activeEffect = effectFn;
    fn();
  }
  effectFn.deps = [];
  effectFn();
}

const data = { ok: true, text: 'hello world' };

function track(target, key) {
  if (!activeEffect) return;
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

function trigger(target, key) {
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  const deps = depsMap.get(key);
  // deps && deps.forEach((fn) => fn());
  // effectsToRun构建一个新的Set, 避免Set中删除又新增导致无限循环
  const effectsToRun = new Set(deps);
  effectsToRun.forEach((fn) => fn());
}
```

## 嵌套的effect与effect栈
```
effect(function effectFn1() {
  effect(function effectFn2() {}
})
```
以下渲染场景就是嵌套
```
const Bar = {
  render() {}
}

const Foo = {
  render() {
    return <Bar />
  }
}
```
相当于
```
effect(() => {
  Foo.render()
  effect(() => {
    Bar.render();
  })
})
```

```
// effect栈
const effectStack = [];

function effect(fn) {
  const effectFn = () => {
    // 清理旧的依赖
    cleanup(effectFn);
    // 将当前正在执行的effect函数赋值给activeEffect
    activeEffect = effectFn;
    // 当前副作用函数入栈
    effectStack.push(effectFn);
    fn();
    // 调用之后将当前副作用函数出站，并将activeEffect还原
    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];
  }
  effectFn.deps = [];
  effectFn();
}
```

## 避免无限递归循环
```
effect(() => obj.foo++);
```
如果trigger触发执行的副作用函数与当前正在执行的副作用函数相同，则不触发执行
```
function trigger(target, key) {
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  const deps = depsMap.get(key);
  // deps && deps.forEach((fn) => fn());
  // effectsToRun构建一个新的Set, 避免Set中删除又新增导致无限循环
  const effectsToRun = new Set();
  deps && deps.forEach(effectFn => {
    if (effectFn !== activeEffect) {
      effectsToRun.add(effectFn);
    }
  });
  effectsToRun.forEach((fn) => fn());
}
```

## 调度执行
```
function effect(fn, options) {
  ...
  effectFn.options = options;
  effectFn();
}

function trigger(target, key) {
  ...
  effectsToRun.forEach(effectFn => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn);
    } else {
      effectFn();
    }
  });
}

const data = { ok: true, text: 'hello world', foo: 1 };
effect(() => console.log(obj.foo), {
  scheduler: (effectFn) => {
    setTimeout(effectFn);
  }
});
obj.foo++;
console.log('结束了');

```
打印结果
```
1
结束了
2
```

## 计算属性computed和lazy

effect参数options中添加lazy: true, 针对这种effect不立刻执行而是返回effectFn函数，可供用户自己选择执行，
对于computed, 实现如下
```
function computed(getter) {
  // 把getter作为副作用函数，创建一个lazy的effect
  const effectFn = effect(getter, { lazy: true });
  const obj = {
    // 当读取value时执行副作用函数
    get value() {
      return effectFn();
    }
  }
  return obj;
}

const sumRes = computed(() => obj.foo + obj.bar);
console.log('sumRes', sumRes.value);
```
但是当前实现，只做到了懒执行，并没有缓存值，即多次访问sumRes.value会导致多次运行计算，即使obj.foo和obj.bar的值没有发生变化

```
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
      return value;
    }
  }
  return obj;
}
```

```
const sumRes = computed(() => obj.foo + obj.bar);
effect(()=> console.log('sumRes', sumRes.value))
obj.foo++
```
当修改obj.foo时，sumRes并没有重新打印
但是上面getter只会把computed内部的effect收集为依赖，而当把计算属性用于另外一个effect时，发生了effect嵌套，外层的effect不会被内层effect中的响应式数据收集，解决办法是添加收集和触发, 如下
```
function computed(getter) {
  ...
  const effectFn = effect(getter, {
    // 添加调度器，其中将dirty重置为true
    scheduler() {
      dirty = true;
      trigger(obj, 'value');
    },
    lazy: true,
  });
  const obj = {
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

```

## watch实现
 
### 基础实现
watch用法如下，第一个参数可以是对象也可以是一个getter, 响应式数据变化时通知对应回调函数执行
```
watch(obj, () => console.log('数据变化了'))
obj.foo++

watch(() => obj.foo, () => console.log('obj.foo数据变化了'))

```
具体实现如下
```
// watch接收两个参数，第一个是source响应式数据，第二个是回调函数
function watch(source, cb) {
  let getter;
  // 如果参数source是函数，则直接把source作为getter
  if (typeof source === 'function') {
    getter = source;
  } else {
    // 否则按照原来方式递归读取source的属性
    getter = () => traverse(source);
  }
  effect(
    () => getter(),
    {
      scheduler() {
        // 当source发生变化时，执行回调函数
        cb();
      }
    }
  )
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
```
### cb中支持新旧值
但是当前实现，回调函数并没有获取新值和旧值

```
function watch(source, cb) {
  let getter;
  // 如果参数source是函数，则直接把source作为getter
  if (typeof source === 'function') {
    getter = source;
  } else {
    // 否则按照原来方式递归读取source的属性
    getter = () => traverse(source);
  }
  let oldValue, newValue;
  const effectFn = effect(
    () => getter(),
    {
      scheduler() {
        newValue = effectFn();
        // 当source发生变化时，执行回调函数
        cb(newValue, oldValue);
        oldValue = newValue;
      },
      lazy: true,
    }
  );
  // 手动调用一次effectFn，获取初始值
  oldValue = effectFn();
} 
```
实现如上，通过lazy，然后手动调用一次effectFn，获取初始值，之后scheduler中执行后获取newValue

### 立即执行的watch与回调执行时机
上面实现，只有数据发生变化时才执行回调，接下来通过添加immediate选项并且为true时，回调函数会立刻执行一次
```
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
      scheduler: job,
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
```
立刻执行和后续执行本质没有区别，所以可以把scheduler调度函数封装为一个通用函数，分别在初始化和后续执行它，第一次执行回调函数时没有所谓的旧值，oldValue为undefined,这也是符合预期的

除了立即执行，还可以指定其他执行时机，例如使用flush选项指定
```
watch(() => obj.foo, (newValue, oldValue) => console.log('数据变化了', newValue, oldValue), {
  flush: 'post',
});
```
其中pre和post分别代表组件更新前和更新后，pre暂时无法模拟，如果是post需要将job放在一个微任务中执行
```
scheduler: () => {
  if (options.flush === 'post') {
    const p = Peomise.resolve();
    p.then(job);
  } else {
    job();
  }
},
```

## Reflect
```
const obj = {
  foo: 1,
  get bar() {
    return this.foo
  }
}

const p = new Proxy(obj, {
  get(target, key) {
    track(target, key);
    return target[key]
  }
})

effect(() => console.log(p.bar))
```
如果使用上面写法，在读取p.bar时，get方法中实际读取的是target[key]， target指向obj，即obj.bar,所里this指向obj导致最终访问到的是obj.foo造成响应式丢失，为了获取默认的行为，应该采用如下写法，其中receive代表谁在读取属性值，这时this指向proxy对象
```
return Reflect.get(target, key, receiver);
```

```
// for...in 时没有确定的key，因此采用ITERATE_KEY
const ITERATE_KEY = Symbol('iterate');

// 拦截 in 操作符
has(target, key) {
  track(target, key);
  return Reflect.has(target, key);
},
// 拦截for...in循环
ownKeys(target) {
  track(target, ITERATE_KEY);
  return Reflect.ownKeys(target);
},

function trigger() {
  ...
  // 将ITERA_KEY相关联的依赖也加入到effectsToRun中
  iterateDeps && iterateDeps.forEach(effectFn => {
    if (effectFn !== activeEffect) {
      effectsToRun.add(effectFn);
    }
  });
  ...
}
```
对于forin添加自定义key,ITERATE_KEY, 在trigger中除了获取key相关的依赖，还要获取ITERA_KEY相关联的依赖，然后触发

上面对于forin处理，如果只是修改属性值，也会触发，那么如何需要判断是修改还是新增属性
```
// 代理set中
// 属性不存在是新增，存在是修改
const type = Object.prototype.hasOwnProperty.call(target, key) ? 'SET' : 'ADD';
// 增加type作为第三个参数，用于区分是新增还是修改
trigger(target, key, type);

// trigger中
if (type === 'ADD') {
  iterateDeps && iterateDeps.forEach(effectFn => {
    if (effectFn !== activeEffect) {
      effectsToRun.add(effectFn);
    }
  });
}

```

delete操作符拦截
```
// 拦截delete操作符
deleteProperty(target, key) {
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
```

### 合理的触发响应

当值前后值不一样时才触发，同时特殊的处理NaN，因为 NaN === NaN 返回false， 因此set中处理如下
```
// 获取旧值
const oldVal = target[key];
// 比较新旧值是否相等，并且都不是NaNs时才触发更新
if (oldVal !== val && (oldVal === oldVal || val === val)) {
  // 增加type作为第三个参数，用于区分是新增还是修改
  trigger(target, key, type);
}
```
假设有如下场景
```
const obj = {}
const proto = { bar: 1 };
const child = reactive(obj);
const parent = reactive(proto);
// 使用parent作为child的原型
Object.setPrototypeOf(child, parent);
effect(() => console.log(child.bar));
child.bar = 2;
```
测试发现，child.bar修改时打印了两次child.bar， 原因在于触发child的set时target是obj，receiver为child,上面不存在bar， 所以通过原型链c触发了parent的set， 这时target是proto但是receive还是child, 解决办法是判断receive是不是target的代理对象，是的时候才触发

```
get(target, key, receiver) {
  // 代理对象可以通过raw属性访问原始对象
  if (key === 'raw') {
    return target;
  }
  track(target, key);
  return Reflect.get(target, key, receiver);
},
set(target, key, val, receiver) {
  // 如果target === receiver.raw，说明receive就是target的代理对象
  if (target === receiver.raw) {
    // 比较新旧值是否相等，并且都不是NaNs时才触发更新
    if (oldVal !== val && (oldVal === oldVal || val === val)) {
      // 增加type作为第三个参数，用于区分是新增还是修改
      trigger(target, key, type);
    }
  }
  return res;
},
```

## 浅响应和深响应
目前为止的实现是浅响应,实现深响应如下
```
get(target, key, receiver) {
  // 代理对象可以通过raw属性访问原始对象
  if (key === 'raw') {
    return target;
  }
  track(target, key);
  const res = Reflect.get(target, key, receiver);
  // 得到原始值结果
  if (typeof res === 'object' && res !== null) {
    // 调用reactive方法，将结果转换为响应式对象
    return reactive(res);
  }
  return res;
},

```
接下来实现shallowReactive浅响应
```
function createReactive(obj, isShallow = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      // 代理对象可以通过raw属性访问原始对象
      if (key === 'raw') {
        return target;
      }
      track(target, key);
      const res = Reflect.get(target, key, receiver);
      // 如果是浅响应，直接返回原始值
      if (isShallow) {
        return res;
      }
      // 得到原始值结果
      if (typeof res === 'object' && res !== null) {
        // 调用reactive方法，将结果转换为响应式对象
        return reactive(res);
      }
      return res;
    },
  })
}
function reactive(obj) {
  return createReactive(obj);
}

function shallowReactive(obj) {
  return createReactive(obj, true);
}
```

## 只读和浅只读

```

function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      ...
      // 非只读时才建立响应联系，因为只读不能修改数据，也就不可能触发副作用执行
      if (!isReadonly) {
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
      ...
    },
    // 拦截delete操作符
    deleteProperty(target, key) {
      // 如果只读，打印警告并返回
      if (isReadonly) {
        console.warn(`${key} is readonly`);
        return true;
      }
    }
  });
}

function readonly(obj) {
  return createReactive(obj, false, true);
}

function shallowReadonly(obj) {
  return createReactive(obj, true, true);
}
```

## 代理数组

### 数组的索引和length
思路是set中新增判断，trigger中拿到length相关的依赖并执行
```
// set
const type = Array.isArray(target) 
// 如果是数组，检测设置索引是否小于数组长度，如果是，则是新增，否则是修改
? Number(key) < target.length ? 'SET' : 'ADD'
: Object.prototype.hasOwnProperty.call(target, key) ? 'SET' : 'ADD';

// trigger函数
if (type === 'ADD' && Array.isArray(target)) {
  // 去除与length相关的依赖
  const lengthDeps = depsMap.get('length');
  lengthDeps && lengthDeps.forEach(effectFn => {
    if (effectFn !== activeEffect) {
      effectsToRun.add(effectFn);
    }
  });
}

const arr = reactive([1]);
effect(() => console.log(arr.length));
arr[3] = 2;
```

但是还有一种场景如下,直接修改length， 这种场景length变小影响当前索引时需要触发，但是比如arr.length = 2，当前索引值没变化就不需要触发
```
const arr = reactive([1]);
effect(() => console.log(arr[0]));
arr.length = 0;
```

需要在trigger中额外判断，如果新修改的值val 小于等于 depsMap中的key，说明这一部分需要触发
```
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
```

### 遍历数组

### for...in循环
只有数组长度变化了，才触发依赖， 因此跟踪时建立将length作为key建立依赖即可
```
const arr = reactive([1, 2, 3]);
effect(() => {
  for(const key in arr) {
    console.log(key);
  }
});
arr[1] = 5;
arr.length = 2;

// 拦截for...in循环
ownKeys(target) {
  track(target, Array.isArray(target) ? 'length': ITERATE_KEY);
  return Reflect.ownKeys(target);
},
```

### for...of循环

for...of是用来循环可迭代对象的，可迭代对象指部署了Symbol.iterator方法的对象，都可用for...in遍历
```
const obj = {
  val: 0,
  [Symbol.iterator]() {
    return {
      next() {
        return {
          value: obj.val ++ ,
          done: obj.val > 10
        }
      }
    }
  }
}

for(const val of obj) {
  console.log(val); // 0,1,2,3,4,5,6,7,8,9
}
```
数组内建了Symbol.iterator方法的实现，因此支持for...of遍历，模拟实现如下
```
arr[Symbol.iterator] = function() {
  const target = this;
  const len = target.length;
  let index = 0;
  return {
    next() {
      return {
        value: index < len ? target[index] : undefined,
        done: index++ >= len
      }
    }
  }
}
```

```
console.log(Array.prototype.values === Array.prototype[Symbol.iterator]) // true
```
迭代数组时会访问数组长度和索引，因此目前已经支持for...of和values,但是为了访问Symbol.iterator属性时报错，修改拦截函数，不追踪symbol类型值
```
// 添加判断，如果key的类型是Symbol,不进行追踪
if (!isReadonly && typeof key !== 'symbol') {
  track(target, key);
}
```

## 数组的查找
针对数组查找方法，因为也会访问数组长度和索引，所以一般情况都支持，但是特殊情况比如
```
const obj = {}
const arr = reactive([obj]);
effect(() => console.log(arr.includes(arr[0])))
```
上面我们期望返回true但是返回了false, 因为两次获取arr[0]时都调用了
```
if (typeof res === 'object' && res !== null) {
  // 调用reactive方法，将结果转换为响应式对象
  return isReadonly ? readonly(res) : reactive(res);
}
```
而reactive每次都是返回一个新对象，因此不一样，解决办法如下
```
// 存储obj到proxy关系
const reactiveMap = new Map();

function reactive(obj) {
  const existProxy = reactiveMap.get(obj);
  // 找到了返回，之前创建过
  if (existProxy) return existProxy;
  // 创建代理对象
  const proxy = createReactive(obj);
  // 存储proxy到obj关系
  reactiveMap.set(obj, proxy);
  return proxy;
}
```

上面问题解决，但是针对
```
const obj = {}
const arr = reactive([obj]);
effect(() => console.log(arr.includes(obj)))
```
上面获取元素数组也是代理对象，和原始对象比较，肯定不一样，如果期望相同需要额外处理，重写includes方法如下
```
const arrayInstrumentations = {
  includes: function(...args) {
    // this是代理对象，先在代理中查找返回结果
    let res = Array.prototype.includes.call(this, ...args);
    if (res === false) {
      // 如果没有找到，则在原始数组中查找
      res = Array.prototype.includes.call(this.raw, ...args);
    }
    // 返回最终结果
    return res;
  }
}

get(target, key, receiver) {
  // 代理对象可以通过raw属性访问原始对象
  if (key === 'raw') {
    return target;
  }
  // 如果是数组并且arrayInstrumentations中有定义方法，返回arrayInstrumentations中的方法的值
  if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
    return Reflect.get(arrayInstrumentations, key, receiver);
  }
  ...
}
```

## 隐式修改数组长度的原型方法

包括push/pop/shift/unshift/splice，这些方法即会读取length属性值也会设置length,这会导致两个独立的副作用函数互相影响，比如
```
const arr = reactive([]);
effect(() => arr.push(1));
effect(() => arr.push(1));
```
上述会导致栈溢出，第一次读取length时，副作用函数已经合length建立了联系，第二次push的时候，不仅读取还会设置length的值，于是第二个函数还未执行完边去执行第一个函数
解决办法是push时我们屏蔽对length的读取，避免与副作用函数建立联系，这个思路是正确的，因为push时我们是在修改操作而非读取
```
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

function track(target, key) {
  // 当禁止追踪时直接返回
  if (!activeEffect || !shouldTrack) return;
  ...
}
```

## 原始值的响应方案

## ref概念
proxy不支持对boolean, string, number, null, undefined等类型的值,需要包裹成对象并添加一个__v_isRef属性来判断这是ref类型值
```
function ref(val) {
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
```

## 响应丢失问题
如下，通过解构返回一个新的对象时会造成响应式丢失
```
const obj = reactive({ foo: 1, bar: 2})
const newObj = {
  ...obj
}
```
因此需要实现一个toRef函数
```
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

const newObj = {
  foo: toRef(obj, 'foo'),
  bar: toRef(obj, 'bar'),
}

function toRefs(obj) {
  const ret = {};
  for (const key in obj) {
    ret[key] = toRef(obj, key);
  }
  return ret;
}
```

## 自动脱ref
在模板中希望用户

```
<p>{{ foo }}</p>
```
访问而不是
```
<p>{{ foo.value }}</p>
```
因此需要自动脱ref,实现如下
```
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
const obj = reactive({ foo: 1, bar: 2});
const newObj = proxyRefs({...toRefs(obj)});

console.log(newObj.foo);
```
实际组件中，组件中setup返回的数据会传递给proxyRefs函数进行处理，这也是为什么模板中可以直接访问一个ref值而无须通过value属性访问


## 组件实现原理

为了使用虚拟节点描述组件，用vnode.type存储组件的选项对象
```
const MyComponent = {
  name: 'MyComponent',
  data() {
    return { foo: 1 }
  }
}

const vnode = {
  type: MyComponent
  // ...
}

```
渲染组件如下
```
function mountComponent(vnode, container, anchor) {
  // 通过vnode.type获取选项对象
  const componentOptions = vnode.type;
  const { render } = componentOptions;
  // 执行渲染
  const subTree = render();
  patch(null, subTree, container, anchor);
}
```

## 组件状态与自更新
```
function mountComponent(vnode, container, anchor) {
  // 通过vnode.type获取选项对象
  const componentOptions = vnode.type;
  const { render, data } = componentOptions;
  // 使用reactive将data返回值包裹成响应式
  const state = reactive(data());
  // 执行渲染
  effect(() => {
    const subTree = render.call(state);
    patch(null, subTree, container, anchor);
  }, {
    scheduler: queueJob
  })
}
```

## 组件实例与组价生命周期
上一步中effect中始终执行的是挂载，为了拿到每次新的subTree，我们需要实现组件实例，来维护整个生命周期的状态
```
function mountComponent(vnode, container, anchor) {
    // 通过vnode.type获取选项对象
    const componentOptions = vnode.type;
    const { render, data, beforeCreate, created, beforeMount, mounted, beforeUpdate, updated } = componentOptions;

    // 调用beforeCreate
    beforeCreate && beforeCreate();

    // 使用reactive将data返回值包裹成响应式
    const state = reactive(data());

    // 定义组件实例
    const instance = {
      // 组件自身状态
      state,
      // 是否挂载
      isMounted: false,
      // 组件所渲染的内容，即子树subTree
      subTree: null,
    }

    // 将组件实例设置到vnode上
    vnode.component = instance;

    // 这里调用created
    created && created.call(state);

    // 执行渲染
    effect(() => {
      // 获取子树
      const subTree = render.call(state);
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
      } else {
        // 这里调用beforeUpdate
        beforeUpdate && beforeUpdate.call(state);
        // 下一次更新时instance.isMounted = true; instance.subTree为上一次的vnode
        patch(instance.subTree, subTree, container, anchor);
        // 这里调用updated
        updated && updated.call(state);
      }
      // 更新subTree
      instance.subTree = subTree;
    }, {
      scheduler: queueJob
    })
  }
```

## props与组件被动更新

```
<MyComponent title="a title" :other="val" />
```
这段代码对应的vnode为
```
const vnode = {
  type: MyComponent,
  props: {
    title: 'a title',
    other: this.val,
  }
}
```
在编写组件时，需要显示的指定组件会接收哪些props数据，如
```
const MyComponent = {
  // 组件接收名为title的props
  props: {
    title: String
  },
  render() {
    return {
      type: 'div',
      children: `count is: ${this.title}`
    }
  }
}
```
对于一个组件，两部分props需要关心
- 为组件传递的props，即组件的vnode.props
- 组件选项中定义的props选项，即MyComponent.props对象

需要结合这两个来解析出组件渲染时需要用到的props数据，实现如下
```
function resolveProps(options, propsData) {
  const props = {};
  const attrs = {};
  // 遍历为组件传递的props数据
  for(const key in propsData) {
    if (key in options) {
      // 如果这个key在组件选项中有定义，则视为合法的props
      props[key] = propsData[key];
    } else {
      // 否则视为attrs
      attrs[key] = propsData[key];
    }
  } 
  return [props, attrs];
}
```
父组件的props变化由
```
const vnode = {
  type: MyComponent,
  props: {
    title: 'a big title',
  }
}
```
变为
```
const vnode = {
  type: MyComponent,
  props: {
    title: 'a small title',
  }
}
```
接下来父组件会进行自更新
组件props发生变化时会调用patchComponent函数来完成子组件的更新，我们把父组件自更新所引起的子组件的更新叫做子组件的被动更新，需要做的是
- 检测子组件是否真的需要更新，因为子组件的props可能是不变的
- 如果需要更新，则更新子组件的props、slots等内容

```
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
```
两点需要注意
- 需要将组件实例添加到新的vnode上， 即n2.component = n1.component 因为实例只有在初次挂载时才生成的，后面没有这个实例
- instance.props对象本身就是浅响应的，因此更新prop值时，只需要设置instance.props对象下的属性值即可触发组件重新渲染
处理props需要编写大量边界代码，单本质上都是通过props选项定义以及为组件传递的props数据来处理的

由于props数据和组件自身状态数据都需要暴露到渲染函数中，并使得渲染函数能通过this访问到他们，因此需要封装一个渲染上下文对象，如下
```
const renderContext =  new Proxy(instance, {
  get(t, k, r) {
    // 取得组件自身状态和props数据
    const { props, state } = t;
    // 先尝试读取自身状态
    if (state && k in state) {
      return state[k];
    } else if (k in props) { // 再尝试读取props
      return props[k]
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
    } else {
      console.error('要设置的数据没有找到', k);
    }
  }
});

...
created && created.call(renderContext);
...

...
const subTree = render.call(renderContext);
...


```

## setup函数实现
setup是vue3新增的选项，主要用于配合组合式API,其写法有两种，一种是返回一个对象，会当做渲染上下文，一种是返回一个渲染函数，会作为模板，另外接收两个参数，props和context
```
const Comp = {
  props: {
    foo: String
  },
  setup(props, context) {
    // props.foo 访问传入的prop值
    const { slots, emit, attrs, expose } = context;
  }
}
```
通常情况不建议将setup和vue2中的其他选项混合使用,注意renderContext中也要处理setupState,因为setup返回的也要暴露给渲染环境
```
let { render } = componentOptions;
const setupContext = { attrs };
// 调用setup函数,将只读版本的props作为第一个参数，避免用户修改props值，setupContext作为第二个参数
const setupResult = setup ? setup(shallowReadonly(instance.props), setupContext) : null;
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
```

## 组件事件与emit实现
emit用来发射自定义事件
```
const MyComponent = {
  name: 'MyComponent',
  setup(props, { emit }) {
    emit('change', 1, 2);
    ...
  },
}
```
父组件中可以监听
```
<MyComponent @change="handler" />

const vnode = {
  type: MyComponent,
  props: {
    onChange: handler,
  }
}

```
可以看到change这个被编译成onChange属性，并存储在props数据中
```
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

// 暂时只需要attrs,因为还没涉及到slots
const setupContext = { attrs, emit };

// 在解析props时，如果以on开头也当做props
function resolveProps(options, propsData) {
  const props = {};
  const attrs = {};
  // 遍历为组件传递的props数据
  for(const key in propsData) {
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

```

## 插槽的工作原理与实现
组件的插槽指组件会预留一个槽位，该槽位具体要渲染的内容由用户输入，下面的MyComponent模板
```
<template>
  <header><slot name="header" /></header>
  <div>
    <slot name=body />
  </div>
  <footer><slot name="footer" /></footer>
</template>
```
当在父组件中使用时，可以根据插槽名字来插入自定义的内容
```
<MyComponent>
  <template #header>
    <h1>我是标题</h1>
  </template>
  <template #body>
    <section>我是内容</section>
  </template>
  <template #footer>
    <p>我是注脚</p>
  </template>
</MyComponent>
```
上述父组件模板会被编译成如下渲染函数
```
function render() {
  return {
    type: MyComponent,
    // 组件的children会被编译成一个对象
    children: {
      header() {
        return { type: 'h1', children: '我是标题' }
      },
      body() {
        return { type: 'section', children: '我是内容' }
      },
      footer() {
        return { type: 'p', children: '我是注脚' }
      },
    }
  }
}
```
插槽内容被编译成插槽函数，而函数返回值对应的具体的插槽内容，组件MyComponent会被编译成如下
```
function render() {
  return [
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
```

```
function mountComponent() {

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
  }
}

const renderContext =  new Proxy(instance, {
  get(t, k, r) {
    // 取得组件自身状态和props数据
    const { props, state, slots } = t;
    // 访问$slots时返回组件实例上的slots
    if (k === '$slots') return slots;
    ...
  },
}
```
实现如上

## 注册生命周期
vue3中还支持下面写法，可以注册多个
```
const Comp = {
  setup(props, context) {
    onMounted(() => console.log('mounted 1'));
    onMounted(() => console.log('mounted 2'));
  }
}

```
实现如下
```
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

function mountComponent() {
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
  // 在调用setup之前，先把组件实例挂载到currentInstance上
  setCurrentInstance(instance);

  // 调用setup函数,将只读版本的props作为第一个参数，避免用户修改props值，setupContext作为第二个参数
  const setupResult = setup ? setup(shallowReadonly(instance.props), setupContext) : null;

  // setup执行完成后，清空currentInstance
  setCurrentInstance(null); 
}

```

## 异步组件和函数式组件

## 异步组价要解决的问题
异步组件指以异步的方式加载并渲染一个组件，在代码分割、服务端下发组件等场景尤为重要，函数式组件允许使用一个函数定义组件，特点是：无状态、编写简单并直观，假设一个场景如下
```
<template>
  <CompA />
  <component :is="asyncComp">
</template>

export default {
  components: { CompA }
  setup() {
    const asyncComp = ref(null);
    // 异步加载组件
    import('CompB.vue').then(CompB => asyncComp.value = CompB)
    return {
      asyncComp
    }
  }
}

```
虽然用户可以实现组件的异步加载和渲染，但整体实现还是比较复杂的，通常我们会考虑
- 如果组件加载失败或超时时，是否要渲染Error组件？
- 组件加载时是否需要展示占位内容？比如渲染一个Loading组件
- 组件加载的速度可能很快，也可能很慢，是否需要设置一个延迟展示的Loading组件的时间？组件在200ms内没有加载才展示Loading，避免组件加载太快导致闪烁
- 组件加载失败是否需要重试

为了解决上面问题，需要在框架层面为异步组件提供更好的封装，对应的能力为
- 允许用户指定加载出错时要渲染的内容
- 允许用户指定Loading组件，以及展示该组件的延迟时间
- 允许用户设置加载组件的超时时间
- 加载失败允许重试

## 异步组件的实现原理

## 封装defineAsyncComponent函数
异步组件本质是通过封装手段来实现友好的用户接口，如下
```
<template>
  <AsyncComp />
</template>

export default {
  components: { 
    // defineAsyncComponent定义一个异步组件，接收一个加载器作为参数
    AsyncComp: defineAsyncComponent(() => import('CompA'))
  }
}
```
这种方式比上面实现方式简单直接的多

```
function defineAsyncComponent(loader) {
  // 存储异步加载的组件
  let InnerComp = null;
  // 返回一个包裹组件
  return {
    name: 'AsyncComponentWrapper',
    setup() {
      // 异步组件是否加载成功
      const loaded = ref(false);
      // 执行加载器函数，返回promise实例，加载成功后赋值给InnerComp，并设置loaded为true
      loader().then(c => {
        InnerComp = c;
        loaded.value = true;
      });
      return () => {
        // 如果加载成功则渲染组件，否则渲染一个占位内容
        return loaded.value ? { type: InnerComp } : { type: Text, children: '' };
      }
    }
  }
}
```
defineAsyncComponent函数本质上是一个高阶组件，返回包装组件


## 超时与Error组件
通常异步组件会以网络请求进行加载，因此需要考虑超时，超时错误时展示Error组件，用户接口设计如下
```
const AsyncComp = defineAsyncComponent({
  loader: () => import('CompA.vue'),
  timeout: 2000, // 超时时间ms
  errorComponent: MyErrorComp // 指定出错时要渲染的组件
})
```
实现如下
```
function defineAsyncComponent(options) {
  // options可以是配置项，也可以只是加载器函数
  if (typeof options === 'function') {
    options = { loader: options };
  }
  const { loader } = options;
  // 存储异步加载的组件
  let InnerComp = null;
  // 返回一个包裹组件
  return {
    name: 'AsyncComponentWrapper',
    setup() {
      // 异步组件是否加载成功
      const loaded = ref(false);
      // 代表是否超时
      const timeout = ref(false);
      // 执行加载器函数，返回promise实例，加载成功后赋值给InnerComp，并设置loaded为true
      loader().then(c => {
        InnerComp = c;
        loaded.value = true;
      });
      let timer = null;
      if (options.timeout) {
        // 如果设置了超时时间，则设置定时器
        timer = setTimeout(() => {
          timeout.value = true;
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
        } else if (timeout.value) {
          // 如果加载超时并且指定了ErrorComponent，则渲染ErrorComponent
          return options.errorComponent ? { type: options.errorComponent } : placeholder;
        }
      }
    }
  }
}
```
在上面基础上，还希望提供一下能力
- 错误发生时，把错误的props传递过去，便于用户更细粒度的处理
- 除了超时之外，能处理其他加载错误比如网络失败

实现如下
```
function defineAsyncComponent(options) {
  // options可以是配置项，也可以只是加载器函数
  if (typeof options === 'function') {
    options = { loader: options };
  }
  const { loader } = options;
  // 存储异步加载的组件
  let InnerComp = null;
  // 返回一个包裹组件
  return {
    name: 'AsyncComponentWrapper',
    setup() {
      // 异步组件是否加载成功
      const loaded = ref(false);
      // 定义error对象
      const error = shallowRef(null);
      // 执行加载器函数，返回promise实例，加载成功后赋值给InnerComp，并设置loaded为true
      loader()
        .then(c => {
          InnerComp = c;
          loaded.value = true;
        })
        .catch(e => error.value = e); // catch捕获加载中的错误
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
        } else {
          return placeholder;
        }
      }
    }
  }
}
```
加载超时会创建一个新的错误对象，渲染时只要发生错误并且指定了ErrorComponent，则渲染ErrorComponent，并将error作为组件的props传递

## 延迟与Loading组件
太早加载Loading，如果网络状态好，会导致loading刚完成渲染就进入卸载阶段，因此需要支持设置延时的功能
```
const AsyncComp = defineAsyncComponent({
  loader: () => import('CompA.vue'),
  delay: 2000, // 超时时间ms
  loadingComponent: MyLoadingComp // 指定出错时要渲染的组件
})
```
具体实现如下
```
function defineAsyncComponent(options) {
  // options可以是配置项，也可以只是加载器函数
  if (typeof options === 'function') {
    options = { loader: options };
  }
  const { loader } = options;
  // 存储异步加载的组件
  let InnerComp = null;
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
      loader()
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

```
注意加载异步组件完毕时，无论成功与否都要清除延迟定时器，不然仍然会展示loading组件

## 重试机制
```
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
```

## 函数式组件
```
function MyFuncComp(props) {
  return { type: 'h1', children: props.title }
}
// 定义props
MyFuncComp.props = {
  title: String
}
```
修改mountComponent函数如下
```
 function mountComponent(vnode, container, anchor) {
    // 检查是否是函数式组件
    const isFunctional = typeof vnode.type === 'function';
    // 通过vnode.type获取选项对象
    const componentOptions = vnode.type;
    if (isFunctional) {
      // 如果是函数式组件，将vnode.type作为渲染函数，vnode.type.props作为props选项定义即可
      componentOptions = {
        render: vnode.type,
        props: vnode.type.props
      }
    }
    ...
 }
```
如果是函数式组件，将vnode.type作为渲染函数，并将组件函数的静态props属性即vnode.type.props作为props选项定义即可,其他逻辑保持不变，当然出于更严谨的考虑，需要通过isFunctional变量实现选择性的初始化逻辑，因为函数式组件不需要初始化data以及生命周期






