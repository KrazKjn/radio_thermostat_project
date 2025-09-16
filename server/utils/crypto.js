const crypto = require("crypto");
const zlib = require("zlib");
const Buffer = require('node:buffer').Buffer;

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

module.exports = {
    decompressZlib,
    formatUnixTime,
    decodeHex,
    parseJSON,
    hookRequest,
    hookResponse,
    hmacSha1,
    hmacMd5,
    aesCbcEncrypt,
    aesCbcDecrypt,
    genAesKey,
    genHashKey,
    encAuth,
    decAuth,
    encode,
    fromhex,
};
