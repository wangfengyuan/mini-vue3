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

// 一个标志位，用于标记当前是否有副作用正在执行
let isFlushing = false;

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


function effect(fn, options) {
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

const data = { ok: true, text: 'hello world', foo: 1, bar: 2 };

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
  const effectsToRun = new Set();
  deps && deps.forEach(effectFn => {
    if (effectFn !== activeEffect) {
      effectsToRun.add(effectFn);
    }
  });
  effectsToRun.forEach(effectFn => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn);
    } else {
      effectFn();
    }
  });
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

// effect(() => console.log(obj.foo), {
//   scheduler: (effectFn) => {
//     // 每次调度将副作用函数添加到任务队列中
//     jobQueue.add(effectFn);
//     // 刷新队列
//     flushJob();
//   }
// });
const effectFn = effect(() => obj.text + obj.foo, {
  lazy: true,
});
const value = effectFn();
console.log('value', value);

const sumRes = computed(() => obj.foo + obj.bar);
console.log('sumRes', sumRes.value);
