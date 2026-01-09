import fs from "fs";

const m = JSON.parse(fs.readFileSync("manifest.src.json", "utf8"));

// TODO: dynamically add the stuff

// // add everything from dist/*.js to manifest.json
// try {
//   const files = fs.readdirSync
// }
// catch (err) {
//   console.log(err);
// }

m.content_scripts[0].js = ["content.js"];
fs.writeFileSync("dist/manifest.json", JSON.stringify(m, null, 2));
