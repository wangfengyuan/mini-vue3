export let activeEffect = null;

export function effect(fn) {
  const effectFn = () => {
    activeEffect = fn;
    fn();
  }
  effectFn();
}