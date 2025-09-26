import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import terser from "@rollup/plugin-terser";
import vue from "rollup-plugin-vue";

export default [
  // ES Module build
  {
    input: "src/index.vue",
    external: ["vue", "element-ui"],
    output: {
      file: "dist/index.js",
      format: "es",
      name: "ElTableExcelExtends",
      sourcemap: false,
    },
    plugins: [
      resolve({
        preferBuiltins: false,
      }),
      commonjs(),
      vue({
        needMap: false,
      }),
      terser({
        sourceMap: false,
        compress: false, // 不压缩代码，保持可读性
        mangle: false, // 不混淆变量名
        output: {
          comments: false, // 去除注释
          beautify: true, // 保持代码格式化
        },
      }),
    ],
  },
  // UMD build
  {
    input: "src/index.vue",
    external: ["vue", "element-ui"],
    output: {
      file: "dist/index.min.js",
      format: "umd",
      name: "ElTableExcelExtends",
      sourcemap: false,
    },
    plugins: [
      resolve({
        preferBuiltins: false,
      }),
      commonjs(),
      vue({
        needMap: false,
      }),
      terser({
        sourceMap: false,
        output: {
          comments: false,
        },
      }),
    ],
  },
];
