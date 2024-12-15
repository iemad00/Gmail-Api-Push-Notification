This folder should contains 
credentials.json file, which can be generated from google cloud

To generate the file go to google cloud console, then:
1- Go to APIs & Services
2- Go to credentials
3- Create Credentials
4- OAuth Client ID
    - Application Type: Web Application
    - Add a redirect URI to /oauth2callback endpoint (which will create the token file)