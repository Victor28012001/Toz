import { defineConfig } from "vite";
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import nodePolyfills from "rollup-plugin-node-polyfills";
import { resolve } from "path";

export default defineConfig({
  base: "/",
  build: {
    target: "es2020",
    outDir: "../www",
    emptyOutDir: true,
    sourcemap: false,
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true, // Remove console logs in production
        drop_debugger: true,
        pure_funcs: ["console.log"],
      },
    },
    rollupOptions: {
      plugins: [nodePolyfills({ crypto: true, process: true })],
      input: {
        main: resolve(__dirname, "index.html"),
      },
      output: {
        manualChunks(id) {
          // Group all three-related packages into one chunk
          if (
            id.includes("node_modules/three") ||
            id.includes("node_modules/three-mesh-bvh")
          ) {
            return "three-bundle";
          }
          if (
            id.includes("node_modules/socket.io-client") ||
            id.includes("node_modules/engine.io-client")
          ) {
            return "socket-bundle";
          }
          if (id.includes("node_modules/moment")) {
            return "vendor-moment";
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
    headers: {
      "Cross-Origin-Embedder-Policy": "credentialless",
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
    open: true,
    proxy: {
      "/auth-callback.html": {
        bypass: (req) => {
          return "/auth-callback.html"; // serve the static file directly
        },
      },
      "/socket.io": {
        target: "https://eloquence-overlay-kisser.ngrok-free.dev",
        ws: true,
        changeOrigin: true,
        secure: false,
      },
      "/auth/callback": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            if (req.headers.cookie) {
              proxyReq.setHeader("cookie", req.headers.cookie);
            }
          });
          proxy.on("proxyRes", (proxyRes) => {
            const cookies = proxyRes.headers["set-cookie"];
            if (cookies) {
              proxyRes.headers["set-cookie"] = cookies.map((cookie) =>
                cookie
                  .replace(/; secure/gi, "")
                  .replace(/; samesite=none/gi, "; samesite=lax"),
              );
            }
          });
        },
      },
      "/auth": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            if (req.headers.cookie) {
              proxyReq.setHeader("cookie", req.headers.cookie);
            }
          });
          proxy.on("proxyRes", (proxyRes) => {
            const cookies = proxyRes.headers["set-cookie"];
            if (cookies) {
              proxyRes.headers["set-cookie"] = cookies.map((cookie) =>
                cookie
                  .replace(/; secure/gi, "")
                  .replace(/; samesite=none/gi, "; samesite=lax"),
              );
            }
          });
        },
      },
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            if (req.headers.cookie) {
              proxyReq.setHeader("cookie", req.headers.cookie);
            }
          });
        },
      },
      '/api/dynamic': {
        target: 'https://app.dynamicauth.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/dynamic/, '')
      }
    },
  },
  optimizeDeps: {
    include: [
      "three",
      "socket.io-client",
      "moment",
      "@civic/auth-web3/react",
      "buffer",
    ],
    esbuildOptions: {
      target: "es2020",
      define: {
        global: "globalThis",
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({
          buffer: true,
          process: true,
        }),
      ],
    },
  },
  // Handle Node.js modules in browser
  define: {
    global: "globalThis",
    "process.env": {},
  },
  resolve: {
    alias: {
      crypto: "crypto-browserify",
      stream: "stream-browserify",
      assert: "assert-browserify",
      process: "process/browser",
      buffer: "buffer/",
    },
  },
});
// import { defineConfig } from "vite";
// import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
// import nodePolyfills from "rollup-plugin-node-polyfills";
// import { resolve } from "path";

// export default defineConfig({
//   base: "/",
//   build: {
//     target: "es2020",
//     outDir: "../www",
//     emptyOutDir: true,
//     sourcemap: false,
//     minify: "terser",
//     terserOptions: {
//       compress: {
//         drop_console: true, // Remove console logs in production
//         drop_debugger: true,
//         pure_funcs: ["console.log"],
//       },
//     },
//     rollupOptions: {
//       plugins: [nodePolyfills({ crypto: true, process: true })],
//       input: {
//         main: resolve(__dirname, "index.html"),
//       },
//       output: {
//         manualChunks(id) {
//           // Group all three-related packages into one chunk
//           if (
//             id.includes("node_modules/three") ||
//             id.includes("node_modules/three-mesh-bvh")
//           ) {
//             return "three-bundle";
//           }
//           if (
//             id.includes("node_modules/socket.io-client") ||
//             id.includes("node_modules/engine.io-client")
//           ) {
//             return "socket-bundle";
//           }
//           if (id.includes("node_modules/moment")) {
//             return "vendor-moment";
//           }
//         },
//       },
//     },
//     chunkSizeWarningLimit: 1000,
//   },
//   server: {
//     port: 5173,
//     headers: {
//       "Cross-Origin-Embedder-Policy": "credentialless",
//       "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
//       "Cross-Origin-Resource-Policy": "cross-origin",
//     },
//     open: true,
//     proxy: {
//       "/auth-callback.html": {
//         bypass: (req) => {
//           return "/auth-callback.html"; // serve the static file directly
//         },
//       },
//       "/socket.io": {
//         target: "https://twg-server.onrender.com",
//         ws: true,
//         changeOrigin: true,
//         secure: false,
//       },
//       "/auth/callback": {
//         target: "https://twg-server.onrender.com",
//         changeOrigin: true,
//         secure: false,
//         configure: (proxy) => {
//           proxy.on("proxyReq", (proxyReq, req) => {
//             if (req.headers.cookie) {
//               proxyReq.setHeader("cookie", req.headers.cookie);
//             }
//           });
//           proxy.on("proxyRes", (proxyRes) => {
//             const cookies = proxyRes.headers["set-cookie"];
//             if (cookies) {
//               proxyRes.headers["set-cookie"] = cookies.map((cookie) =>
//                 cookie
//                   .replace(/; secure/gi, "")
//                   .replace(/; samesite=none/gi, "; samesite=lax"),
//               );
//             }
//           });
//         },
//       },
//       "/auth": {
//         target: "https://twg-server.onrender.com",
//         changeOrigin: true,
//         secure: false,
//         configure: (proxy) => {
//           proxy.on("proxyReq", (proxyReq, req) => {
//             if (req.headers.cookie) {
//               proxyReq.setHeader("cookie", req.headers.cookie);
//             }
//           });
//           proxy.on("proxyRes", (proxyRes) => {
//             const cookies = proxyRes.headers["set-cookie"];
//             if (cookies) {
//               proxyRes.headers["set-cookie"] = cookies.map((cookie) =>
//                 cookie
//                   .replace(/; secure/gi, "")
//                   .replace(/; samesite=none/gi, "; samesite=lax"),
//               );
//             }
//           });
//         },
//       },
//       "/api": {
//         target: "https://twg-server.onrender.com",
//         changeOrigin: true,
//         secure: false,
//         configure: (proxy) => {
//           proxy.on("proxyReq", (proxyReq, req) => {
//             if (req.headers.cookie) {
//               proxyReq.setHeader("cookie", req.headers.cookie);
//             }
//           });
//         },
//       },
//       '/api/dynamic': {
//         target: 'https://app.dynamicauth.com',
//         changeOrigin: true,
//         rewrite: (path) => path.replace(/^\/api\/dynamic/, '')
//       },
//     },
//   },
//   optimizeDeps: {
//     include: [
//       "three",
//       "socket.io-client",
//       "moment",
//       "@civic/auth-web3/react",
//       "buffer",
//     ],
//     esbuildOptions: {
//       target: "es2020",
//       define: {
//         global: "globalThis",
//       },
//       plugins: [
//         NodeGlobalsPolyfillPlugin({
//           buffer: true,
//           process: true,
//         }),
//       ],
//     },
//   },
//   // Handle Node.js modules in browser
//   define: {
//     global: "globalThis",
//     "process.env": {},
//   },
//   resolve: {
//     alias: {
//       crypto: "crypto-browserify",
//       stream: "stream-browserify",
//       assert: "assert-browserify",
//       process: "process/browser",
//       buffer: "buffer/",
//     },
//   },
// });
