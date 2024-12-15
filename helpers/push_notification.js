// @ts-nocheck
const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");

// Load OAuth2 client credentials
const credentialsPath = path.join(
  __dirname,
  "../gmail-api-credentials/credentials.json"
);
const credentials = JSON.parse(fs.readFileSync(credentialsPath));
const { client_secret, client_id, redirect_uris } =
  credentials.installed || credentials.web;
const oAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirect_uris[0]
);
const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

// This file is used to store the token after authentication
const tokenPath = path.join(__dirname, "../gmail-api-credentials/token.json");
// This file is used to store the last historyID in order to get the recent message only
const lastHistoryIdPath = path.join(
  __dirname,
  "../gmail-api-credentials/lastHistoryId.txt"
);

async function processPushNotification(data) {
  const newHistoryId = data.historyId;

  // We use the last history ID to get the last message that was added
  let lastHistoryId = null;
  if (fs.existsSync(lastHistoryIdPath)) {
    lastHistoryId = fs.readFileSync(lastHistoryIdPath, "utf-8");
  }

  if (!lastHistoryId) {
    lastHistoryId = newHistoryId - 1; // Default to one before the new history ID if not found
  }

  try {
    const historyResponse = await gmail.users.history.list({
      userId: "me",
      startHistoryId: lastHistoryId,
    });

    const history = historyResponse.data.history;
    if (history && history.length > 0) {
      for (const record of history) {
        if (record.messagesAdded) {
          for (const message of record.messagesAdded) {
            const msgId = message.message.id;
            const msg = await gmail.users.messages.get({
              userId: "me",
              id: msgId,
            });

            const headers = msg?.data?.payload?.headers;
            const fromHeader = headers?.find(
              (header) => header.name === "From"
            );
            const subjectHeader = headers?.find(
              (header) => header.name === "Subject"
            );
            const body = msg?.data?.payload?.parts
              ? msg.data.payload.parts.map((part) => part?.body?.data).join("")
              : msg?.data?.payload?.body?.data ?? "";
            const decodedBody = Buffer.from(body, "base64").toString("utf-8");

            if (fromHeader?.value && decodeEmailBody(decodedBody) !== "") {
              console.log("New message from:", fromHeader.value);
              console.log("Subject:", subjectHeader?.value);
              console.log("Message:", decodeEmailBody(decodedBody));
            }
          }
        }
      }
    }

    // Update the last processed history ID
    fs.writeFileSync(lastHistoryIdPath, newHistoryId.toString());
  } catch (error) {
    console.error("Error processing push notification:", error.message);
    throw new Error("Internal Server Error");
  }
}

// Function to decode the email body
// This function is used to remove the quoted replies from the email body
// and return the original message
function decodeEmailBody(body) {
  // Remove HTML tags
  let cleanBody = body.replace(/<\/?[^>]+(>|$)/g, "");

  // Split the body into lines
  let lines = cleanBody.split("\n");

  // Patterns to identify quoted replies
  const replyPatterns = [
    /^On .* wrote:/,
    /^>+/,
    /^From:/,
    /^Sent:/,
    /^To:/,
    /^Subject:/,
    /^______/,
    /^P {/,
  ];

  // Filter out the quoted lines
  let originalMessageLines = [];
  for (let line of lines) {
    let isReply = replyPatterns.some((pattern) => pattern.test(line.trim()));
    if (isReply) break;
    originalMessageLines.push(line);
  }

  // Join the filtered lines back into a single string
  let originalMessage = originalMessageLines.join("\n").trim();

  return originalMessage;
}

module.exports = {
  oAuth2Client,
  gmail,
  processPushNotification,
  tokenPath,
  lastHistoryIdPath,
};
