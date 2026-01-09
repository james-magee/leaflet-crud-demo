// const esbuild = require("esbuild");
import esbuild from "esbuild";

esbuild
  .build({
    entryPoints: ["src/content.ts"],
    bundle: true,
    tsconfig: "tsconfig.json",
    outfile: "dist/content.js",
    loader: {
      ".css": "css",
      ".png": "dataurl",
    },
  })
  .catch(() => process.exit(1));

// // continuous rebuild
// const run = async () => {
//   const ctx = await esbuild.context({
//     entryPoints: ["src/content.ts"],
//     outfile: "dist/content.js",
//     bundle: true,
//     tsconfig: "tsconfig.json",
//     loader: {
//       ".css": "css",
//       ".png": "dataurl",
//     },

//   })
// }
