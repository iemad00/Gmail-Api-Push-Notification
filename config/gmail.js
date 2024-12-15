// @ts-nocheck
const fs = require("fs");
const {
  tokenPath,
  lastHistoryIdPath,
  gmail,
  oAuth2Client,
} = require("../helpers/push_notification");

const topicName = process.env.topicName;

// To get the email access token
function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/gmail.readonly"],
    prompt: "consent", // Force Google to provide a refresh_token, even if one has already been issued
  });
  console.log("Authorize this app by visiting this URL:", authUrl);
}

async function initializePushNotification() {
  // Here we check if we have token file, or create a new one
  if (fs.existsSync(tokenPath)) {
    const token = JSON.parse(fs.readFileSync(tokenPath));
    oAuth2Client.setCredentials(token);
    // To refresh the token before it expires
    setTokenRefresh();
    await setUpGmailWatch();
  } else {
    getAccessToken(oAuth2Client, () =>
      console.log("Token acquired and saved.")
    );
  }
}

async function setUpGmailWatch() {
  try {
    const res = await gmail.users.watch({
      userId: "me",
      requestBody: { topicName, labelIds: ["INBOX", "SPAM"] }, // To get emails from both INBOX and SPAM
    });
    console.log("Watch response:", res.data);
    fs.writeFileSync(lastHistoryIdPath, res.data.historyId.toString());
  } catch (error) {
    if (
      error.response &&
      (error.response.data.error === "invalid_grant" ||
        error.response.data.error === "unauthorized_client")
    )
      handleExpiredToken();

    console.error(
      "Error setting up Gmail watch:",
      error.response ? error.response.data : error.message
    );
  }
}

function handleExpiredToken() {
  console.error("Access token expired, removing token file");
  if (fs.existsSync(tokenPath)) {
    fs.unlinkSync(tokenPath);
  }
  initializePushNotification();
}

// To prevent token expiration
function setTokenRefresh() {
  oAuth2Client.on("tokens", (tokens) => {
    if (tokens.refresh_token) {
      console.log("Refresh token acquired:", tokens.refresh_token);
    }
    const existingToken = fs.existsSync(tokenPath)
      ? JSON.parse(fs.readFileSync(tokenPath))
      : {};
    const updatedToken = { ...existingToken, ...tokens }; // Merge tokens
    fs.writeFileSync(tokenPath, JSON.stringify(updatedToken));
    console.log("Updated token saved to file:", updatedToken);
  });

  setInterval(async () => {
    try {
      console.log("Refreshing access token");
      await oAuth2Client.getAccessToken();
    } catch (error) {
      if (
        error.response &&
        (error.response.data.error === "invalid_grant" ||
          error.response.data.error === "unauthorized_client")
      ) {
        handleExpiredToken();
      } else {
        console.error("Error refreshing access token", error);
      }
    }
  }, 1000 * 60 * 60); // Refresh every hour
}

module.exports = {
  initializePushNotification,
  setTokenRefresh,
};
