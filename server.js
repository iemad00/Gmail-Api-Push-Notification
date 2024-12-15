const http = require("http");
const app = require("./app");

const httpPort = 3000;

http.createServer(app).listen(httpPort, () => {
  console.log(
    "http Listener",
    "| port:",
    httpPort,
    "| Time:",
    new Date().toISOString()
  );
});
