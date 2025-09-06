const { HVAC_MODE_OFF, HVAC_MODE_HEAT, HVAC_MODE_COOL, HVAC_MODE_AUTO } = require('./constants/hvac_mode.js');

const express = require("express");
const crypto = require("crypto");
const zlib = require("zlib");
const url = require("url");
const http = require("http");
const bodyParser = require("body-parser");
const Buffer = require('node:buffer').Buffer; // Import Buffer from node:buffer
const db = require('./db'); // Import your db module

const app = express();

const showDebug = process.env.DEBUG === "true";
const persistToDatabase = process.env.DATABASE === "true";

const ipToIdMap = {};  // Object to store IP → ID mappings
const uuidToIdMap = {};  // Object to store UUID → ID mappings

// Function to add an entry
function addDeviceByIP(ip, id) {
    ipToIdMap[ip] = id;
}

// Function to get ID by IP
function getIdByIp(ip) {
    return ipToIdMap[ip] || null;  // Returns ID or null if not found
}

// Function to add an entry
function addDeviceByUUID(uuid, id) {
    uuidToIdMap[uuid] = id;
}

// Function to get ID by UUID
function getIdByUUID(uuid) {
    return uuidToIdMap[uuid] || null;  // Returns ID or null if not found
}

const decompressZlib = (data) => {
    try {
        return zlib.inflateSync(Buffer.from(data, "binary")).toString("utf8");
    } catch (err) {
        console.error("Zlib decompression failed:", err);
        return "Not compressed with Zlib";
    }
};

function formatUnixTime(unixTimestamp) {
    return new Date(unixTimestamp).toLocaleString();
}

// Function to decode Hex
const decodeHex = (data) => {
    try {
        return fromhex(data).toString("utf8");
    } catch (err) {
        console.error("Hex decoding error:", err);
        return "Invalid Hex data";
    }
};

// Function to parse JSON
const parseJSON = (data) => {
    try {
        return JSON.stringify(JSON.parse(data), null, 2);
    } catch (err) {
        console.error("JSON parsing error:", err);
        return "Invalid JSON data";
    }
};

function hookRequest(request) {
    // tweak to change the request from thermostat to cloud
    return request;
}

function hookResponse(response) {
    // tweak to change the response from cloud to your thermostat
    return response;
}

function hmacSha1(key, msg) {
    return crypto.createHmac("sha1", key).update(msg).digest();
}

function hmacMd5(key, msg) {
    return crypto.createHmac("md5", key).update(msg).digest();
}

function aesCbcEncrypt(key, iv, msg) {
    const cipher = crypto.createCipheriv("aes-128-cbc", key, iv);
    return Buffer.concat([cipher.update(msg), cipher.final()]);
}

function aesCbcDecrypt(key, iv, msg, outFormat = undefined) {
    // Validate key, iv, and msg formats
    if (!Buffer.isBuffer(key) || key.length !== 16) {
        throw new Error("Invalid key: Must be a 16-byte Buffer.");
    }
    if (!Buffer.isBuffer(iv) || iv.length !== 16) {
        throw new Error("Invalid IV: Must be a 16-byte Buffer.");
    }
    if (!Buffer.isBuffer(msg) || msg.length % 16 !== 0) {
        throw new Error("Invalid message: Must be a Buffer with a length multiple of 16 bytes.");
    }

    const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
    decipher.setAutoPadding(false); // Disable automatic padding
    let decrypted;
    const updated = decipher.update(msg);
    try {
        decrypted = Buffer.concat([updated, decipher.final()]);
    }
    catch (err) {
        decrypted = updated;
    }
    return outFormat ? decrypted.toString(outFormat) : decrypted;
}

function genAesKey(uuid, authKey, loops = 1000) {
    let salt = Buffer.concat([uuid.slice(-8), Buffer.from([0, 0, 0, 1])]);
    let ret = hmacSha1(authKey, salt);
    let data = Buffer.from(ret);

    for (let i = 1; i < loops; i++) {
        data = hmacSha1(authKey, data);
        ret = Buffer.from(ret.map((v, idx) => v ^ data[idx]));
    }

    return ret.subarray(0, 16);
}

function genHashKey(authKey) {
    return crypto.createHash("md5").update(authKey.slice(0, 8)).digest().subarray(0, 16);
}

function encAuth(encKey, authKey, iv, msg) {
    const mac = hmacMd5(authKey, msg);
    return aesCbcEncrypt(encKey, iv, Buffer.concat([mac, msg]));
}

function decAuth(encKey, authKey, iv, msg) {
    if (encKey.length !== 16) throw new Error("wrong encKey length");
    if (iv.length !== 16) throw new Error("wrong iv length");
    if (msg.length % 16 !== 0) throw new Error("msg length not multiple of 16 bytes");

    let plain;
    try {
        plain = aesCbcDecrypt(encKey, iv, msg);
    } catch (err) {
        console.error("Decryption failed:", err);
    }
    const mac = plain.subarray(0, 16);
    let extractedMsg;

    try {
        extractedMsg = plain.subarray(16).toString().replace(/\0/g, '').trim();
    } catch (err) {
        throw new Error("wrong msg format");
    }

    const computedMac = hmacMd5(authKey, Buffer.from(extractedMsg));
    if (!mac.equals(computedMac)) throw new Error("wrong msg integrity");

    return Buffer.from(extractedMsg);
}

function encode(text) {
    return Buffer.from(text, "utf8");
}

function fromhex(text) {
    return Buffer.from(text, "hex");
}

app.post('/captureStatIn', (req, res) => {
    let bodyB = Buffer.alloc(0); // Initialize empty buffer to store incoming stream data
    let body = "";
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress;
    const currentTime = Date.now();
  
    req.on("data", chunk => {
        if (showDebug) {
            console.log("Debug: Received chunk of data");
            console.log("Chunk Type:", typeof chunk); // Expected: object
            console.log("Is Buffer?", Buffer.isBuffer(chunk)); // Expected: true
        }
        bodyB = Buffer.concat([bodyB, chunk]); // Append streamed chunks of binary data
        body += chunk; // Append streamed chunks of string data
    });
  
    req.on("end", () => {
        console.log(`${formatUnixTime(currentTime)}: Received POST request: ${req.url}`); // Log the request body
        if (showDebug) {
            console.log("Streamed Data:", body); // Print raw stream  
            console.log("Streamed Binary Data:", bodyB); // Print raw binary stream 
        }

        const request = req.body ?? body;

        const offset = request.indexOf("}");
        // Find the offset of '}'
        const offsetB = bodyB.indexOf(Buffer.from("}"));

        if (offsetB !== -1) {
            if (showDebug) {
                console.log(`Character '}' found at offset: ${offsetB}`);
            }
        } else {
            console.log("Character '}' not found.");
        }      
        if (offset < 0) {
            res.status(400).send('Need a JSON header');
            return;
        }

        const requestHdr = request.slice(0, offset + 1);
        let jsonHdr;

        try {
            jsonHdr = JSON.parse(requestHdr.toString());
        } catch (err) {
            res.status(400).send('Need a valid JSON header');
            return;
        }

        if (!jsonHdr.uuid || !jsonHdr.eiv || jsonHdr.eiv.length !== 32) {
            res.status(400).send('Invalid JSON header');
            return;
        }

        let uuid, eiv;
        try {
            uuid = encode(jsonHdr.uuid);
            eiv = fromhex(jsonHdr.eiv);
        } catch (err) {
            res.status(400).send('Invalid hex values in JSON header');
            return;
        }

        if (uuid === undefined) {
            uuid = encode("5cdad4517dda");
        }

        const authkey = encode("beaa4c96");

        if (showDebug) {
            console.log(uuid.toString('hex')); // Convert back to string if needed
            console.log(authkey.toString('hex'));
        }

        const aesKey = genAesKey(uuid, authkey);
        const hashKey = genHashKey(authkey);

        let requestPlaintext;
        let responsePlaintext;

        if (showDebug) {
            console.log("Encryption data:");
            console.log("UUID (Hex): ", uuid.toString('hex'))
            console.log("AuthKey (Hex): ", authkey.toString('hex'))
            console.log("AES Key (Hex): ", aesKey.toString('hex'));
            console.log("Hash Key (Hex): ", hashKey.toString('hex'));
            console.log("EIV Key (Hex): ", eiv.toString('hex'));
        }

        const encryptedData = bodyB.subarray(offsetB + 1);
        if (showDebug) {
            console.log("Length of Encrypted Data: ", encryptedData.length);
            console.log("Encrypted Data (Hex): ", encryptedData.toString('hex'));
        }
        requestPlaintext = decAuth(aesKey, hashKey, eiv, encryptedData);
        if (requestPlaintext === null || requestPlaintext === undefined) {      
            res.status(400).send('Decryption failed');
            return;
        }
        console.log("[thermostat to us] =>", parseJSON(requestPlaintext));
        
        const jsonString = requestPlaintext.toString("utf-8"); // Convert to string
        const jsonData = JSON.parse(jsonString);  // Convert to JSON object
        //console.log(jsonData);

        if (jsonData.tstat) {
            let thermostat_id = undefined; //getIdByUUID(jsonHdr.uuid);
            let saveToDatabase = false;
            let location = "";
            if (!thermostat_id) {
                // Prepare the query to get the thermostat ID from the UUID
                const getThermostatIdStmt = db.prepare(`
                    SELECT id, scanMode, location FROM thermostats WHERE uuid = ?;
                `);

                try {
                    // Fetch thermostat_id from UUID
                    const thermostatRow = getThermostatIdStmt.get(jsonHdr.uuid);
                    if (!thermostatRow) {
                        console.error("Error: Thermostat not found for UUID:", jsonHdr.uuid);
                        return;
                    }
                    thermostat_id = thermostatRow.id;
                    location = thermostatRow.location;
                    saveToDatabase = thermostatRow.scanMode === HVAC_MODE_COOL; // Check if scanMode is set to HVAC_MODE_COOL
                    addDeviceByUUID(jsonHdr.uuid, thermostat_id);
                } catch (error) {
                    console.error("Error: Thermostat not found for UUID:", jsonHdr.uuid);
                    console.log(`Error: Thermostat not found for UUID: ${jsonHdr.uuid}. Error: ${error}`);
                }            
            }
            if (persistToDatabase || saveToDatabase) {
                // Database insertion
                const stmt = db.prepare(`
                    INSERT INTO scan_data (thermostat_id, timestamp, temp, tmode, tTemp, tstate, fstate)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);
                try {
                    stmt.run(
                        thermostat_id,
                        currentTime,
                        jsonData.tstat.temp,
                        jsonData.tstat.tmode,
                        jsonData.tstat.tmode === HVAC_MODE_COOL ? jsonData.tstat.t_cool : jsonData.tstat.tmode === HVAC_MODE_HEAT ? jsonData.tstat.t_heat : null,
                        jsonData.tstat.tstate,
                        jsonData.tstat.fstate,
                    );
                    console.log("Thermostat data saved: ", location);
                } catch (error) {
                    console.log(`Error saving Thermostat data for: ${location}. Error: ${error}`);
                }            
            }
        }

        if (process.env.FWD_URL) {
            const patchedRequestPlaintext = hookRequest(requestPlaintext);
            const newPayload = encAuth(aesKey, hashKey, eiv, patchedRequestPlaintext);
            const newRequest = JSON.stringify({ uuid: jsonHdr.uuid, eiv: jsonHdr.eiv, payload: newPayload });
    
            const parsedUrl = url.parse(process.env.FWD_URL);
            const options = {
                hostname: parsedUrl.hostname,
                path: parsedUrl.path,
                method: 'POST',
                headers: { 'Content-Type': 'application/octet-stream' }
            };
    
            const forwardReq = http.request(options, forwardRes => {
                let responseBody = [];
                forwardRes.on('data', chunk => responseBody.push(chunk));
                forwardRes.on('end', () => {
                    try {
                        responsePlaintext = decAuth(aesKey, hashKey, eiv, Buffer.concat(responseBody));
                        responsePlaintext = hookResponse(responsePlaintext);
                    } catch (err) {
                        res.status(400).send('Forward URL returned malformed response');
                        return;
                    }
    
                    console.log("[us to thermostat] <=", responsePlaintext.toString());
                    const responseEncrypted = encAuth(aesKey, hashKey, eiv, responsePlaintext);

                    res.status(200).header('Content-Type', 'application/octet-stream').send(responseEncrypted);
                });
            });
    
            forwardReq.on('error', err => res.status(400).send('Forward request failed'));
            forwardReq.write(newRequest);
            forwardReq.end();
        } else {
            responsePlaintext = Buffer.from('{"ignore":0}');
            console.log("[us to thermostat] <=", responsePlaintext.toString());
    
            const responseEncrypted = encAuth(aesKey, hashKey, eiv, responsePlaintext);
            res.status(200).header('Content-Type', 'application/octet-stream').send(responseEncrypted);
        }
    });
  
    req.on("error", err => {
        console.error("Stream Error:", err);
        res.status(500).send("Error capturing stream");
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));