const express = require("express");
const bodyParser = require("body-parser");
const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");
const readline = require("readline");
const app = express();

app.use(bodyParser.json());

// Load OAuth2 client credentials
const credentialsPath = path.join(__dirname, 'credentials.json');
const credentials = JSON.parse(fs.readFileSync(credentialsPath));
const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

const tokenPath = path.join(__dirname, 'token.json');
if (fs.existsSync(tokenPath)) {
    const token = JSON.parse(fs.readFileSync(tokenPath));
    oAuth2Client.setCredentials(token);
} else {
    getAccessToken(oAuth2Client, () => console.log('Token acquired and saved.'));
}

function getAccessToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    });
    console.log('Authorize this app by visiting this URL:', authUrl);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error retrieving access token', err);
            oAuth2Client.setCredentials(token);
            fs.writeFileSync(tokenPath, JSON.stringify(token));
            callback(oAuth2Client);
        });
    });
}

const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
const topicName = 'projects/push-notification-test-428218/topics/test';

async function setUpGmailWatch() {
    try {
        const res = await gmail.users.watch({
            userId: 'me',
            requestBody: { topicName, labelIds: ['INBOX'] },
        });
        console.log('Watch response:', res.data);
    } catch (error) {
        console.error('Error setting up Gmail watch:', error.response ? error.response.data : error.message);
    }
}

app.post('/pubsub/push', async (req, res) => {
    const message = Buffer.from(req.body.message.data, 'base64').toString('utf-8');
    console.log('Received message:', message);

    const data = JSON.parse(message);
    const historyId = data.historyId;

    try {
        const historyResponse = await gmail.users.history.list({
            userId: 'me',
            startHistoryId: historyId,
        });

        const history = historyResponse.data.history;
        if (history && history.length > 0) {
            for (const record of history) {
                if (record.messagesAdded) {
                    for (const message of record.messagesAdded) {
                        const msgId = message.message.id;
                        const msg = await gmail.users.messages.get({
                            userId: 'me',
                            id: msgId,
                        });

                        const headers = msg.data.payload.headers;
                        const fromHeader = headers.find(header => header.name === 'From');
                        const subjectHeader = headers.find(header => header.name === 'Subject');
                        const body = msg.data.payload.parts
                            ? msg.data.payload.parts.map(part => part.body.data).join('')
                            : msg.data.payload.body.data;
                        const decodedBody = Buffer.from(body, 'base64').toString('utf-8');

                        console.log('New message from:', fromHeader ? fromHeader.value : 'Unknown');
                        console.log('Subject:', subjectHeader ? subjectHeader.value : 'No subject');
                        console.log('Message:', decodedBody);
                    }
                }
            }
        }

        res.status(200).send();
    } catch (error) {
        console.error('Error processing push notification:', error.message);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/oauth2callback', (req, res) => {
    const code = req.query.code;
    oAuth2Client.getToken(code, (err, token) => {
        if (err) return res.status(400).send('Error retrieving access token');
        oAuth2Client.setCredentials(token);
        fs.writeFileSync(tokenPath, JSON.stringify(token));
        res.send('Authorization successful! You can close this tab.');
    });
});

app.listen(3000, async () => {
    console.log('App is running on port 3000');
    if (!fs.existsSync(tokenPath)) {
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/gmail.readonly'],
        });
        console.log('Please authorize the app by visiting this URL:', authUrl);
    } else {
        await setUpGmailWatch();
    }
});
