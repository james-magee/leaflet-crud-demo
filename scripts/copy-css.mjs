import fs from "fs";

// read content.css
const userCss = fs.readFileSync("src/content.css", "utf-8");

// append to content css
fs.appendFileSync("dist/content.css", userCss);

// fs.copyFileSync("src/content.css", "dist/content.css");
