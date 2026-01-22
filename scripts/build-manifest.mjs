import fs from "fs";

const m = JSON.parse(fs.readFileSync("manifest.src.json", "utf8"));
m.content_scripts[0].js = ["content.js"];
fs.writeFileSync("dist/manifest.json", JSON.stringify(m, null, 2));
