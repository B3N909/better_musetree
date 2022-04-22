const express = require("express");
const app = express();

app.use(express.static("public"));

app.listen(9090, () => console.log("http://127.0.0.1:9090"));