const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "dist");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

http
  .createServer((request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const file = path.join(root, pathname === "/" ? "index.html" : pathname);

    if (!file.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end();
      return;
    }

    fs.readFile(file, (error, data) => {
      if (error) {
        response.writeHead(404).end("Not found");
        return;
      }
      response.setHeader("Content-Type", contentTypes[path.extname(file)] || "application/octet-stream");
      response.end(data);
    });
  })
  .listen(4174, "127.0.0.1", () => console.log("Local: http://127.0.0.1:4174"));
