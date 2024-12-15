// @ts-nocheck
const express = require("express");
const router = express.Router();
const {
  processPushNotification,
  tokenPath,
  oAuth2Client,
} = require("../helpers/push_notification");

const { setTokenRefresh } = require("../config/gmail");
const fs = require("fs");

// This endpoint is used to get the token
// It will be called by google cloud after the user authorizes the email that he wish to use for the push notification
router.get("/oauth2callback", (req, res) => {
  const code = req.query.code;
  oAuth2Client.getToken(code, (err, token) => {
    if (err) return res.status(400).send("Error retrieving access token");
    oAuth2Client.setCredentials(token);
    fs.writeFileSync(tokenPath, JSON.stringify(token));

    setTokenRefresh();
    res.send("Authorization successful! You can close this tab.");
  });
});

// This endpoint is used to receive the push notification from google cloud
// It will be called by google cloud when a new email is received
router.post("/pubsub/push", async (req, res) => {
  if (!req.body || !req.body.message || !req.body.message.data)
    return res.status(400).send("Missing Required Parameters");

  const message = Buffer.from(req.body.message.data, "base64").toString(
    "utf-8"
  );
  console.log("Received message:", message);
  res.status(200).send();

  const data = JSON.parse(message);
  try {
    await processPushNotification(data);
  } catch (error) {}
});

module.exports = router;
