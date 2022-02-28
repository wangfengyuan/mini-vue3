/**
 * 使用了WeakMap、Map和Set数据结构
 * WeakMap由 target --> Map 组成
 * Map由 key --> Set 组成
 * Set保存了所有的依赖
 */

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
