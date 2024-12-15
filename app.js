// @ts-nocheck
require("dotenv").config();

const { initializePushNotification } = require("./config/gmail");

const express = require("express");
const bodyParser = require("body-parser");
const app = express();
app.use(bodyParser.json());

const gmailRoute = require("./routes/gmail");
app.use("/gmail", gmailRoute);

initializePushNotification();

module.exports = app;
