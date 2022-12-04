import { createApp, h } from '../dist/vue.esm-bundler.js';
const App = {
  render() {
    return h("div", "hi, " + this.msg);
  },

  setup() {
    return {
      msg: "mini-vue",
    };
  },
}

createApp(App).mount('#app');