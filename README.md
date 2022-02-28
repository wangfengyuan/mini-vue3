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
