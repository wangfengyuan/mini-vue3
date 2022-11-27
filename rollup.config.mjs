import path from 'path';
import json from '@rollup/plugin-json';
import ts from 'rollup-plugin-typescript2';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));

const packagesDir = path.resolve(__dirname, 'packages');
const packageDir = path.resolve(packagesDir, process.env.TARGET);

const resolve = (p) => path.resolve(packageDir, p);

// 找到package.json文件
const pkg = require(resolve('package.json'));

const name = path.basename(packageDir);

// 对打包类型，做一个映射表，根据每个包提供给的formats进行格式化需要打包的内容
const outputConfig = {
  'esm-bundler': {
    file: resolve(`dist/${name}.esm-bundler.js`),
    format: 'es',
  },
  'cjs': {
    file: resolve(`dist/${name}.cjs.js`),
    format: 'cjs'
  },
  'global': {
    file: resolve(`dist/${name}.global.js`),
    format: 'iife' //立即执行函数
  }
}


const options = pkg.buildOptions; //package.json中的自定义的配置

function createConfig(output) {
  output.name = name;
  output.sourcemap = true;
  return {
    input: resolve('src/index.ts'),
    output,
    plugins: [
      json(),
      ts({
        tsconfig: path.resolve(__dirname, 'tsconfig.json')
      }),
      nodeResolve(),
    ]
  }
}


const rollupConfig = options.formats.map(format => createConfig(outputConfig[format]));


export default rollupConfig;