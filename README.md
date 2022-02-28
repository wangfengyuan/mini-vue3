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

