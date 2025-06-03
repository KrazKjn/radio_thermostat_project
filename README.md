# radio_thermostat_project
React based thermostat application to manage the Radio Thermostat CT50 via it's WiFi module's REST API. Uses NodeJS and Python for a server and advanced control system.

In the thermostats table, there is a field named scanMode which honors values:
- 0 -> Scanning not allowed
- 1 -> Scanning enabled via the UI and the scanning is performed using a setInterval command currently in proxy.js
- 2 -> Cloud updates via configuring the thermostat's /cloud endpoint with the interval, url, enabled, and authkey values.

Example:
{"interval":60,"url":"http://192.168.0.101:3000/captureStatIn","status":2,"enabled":1,"authkey":"<yourkey>","status_code":200}

When the scanMode is set to 2 and the /cloud endpoint is configured correctly, the thermostat sends data to the CaptureAndDecodeCloudData.js service. The data is decrypted and saved into the database.

As this is still a work in progress, here are some high level areas I am considering:
- Merging CaptureAndDecodeCloudData.js and proxy.js into a single service.
- Run this on a Raspberry PI.
- Using HTTPS with a certificate so that I can access remotely.
- Moving user credentials to the database.
- Adding Roles.
- Adding a User Registration.
- Creating a Real-Time process optimization controller whereas we try to reduce energy consumption and reduce the total number of HVAC cycling events (Start/Stop) as this increases electricity surge/demand and is taxing to the HVAC equipment.
