'use strict';
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const Nexmo = require('nexmo');

const nexmo = new Nexmo({
    apiKey: process.env.NEXMO_API_KEY,
    apiSecret: process.env.NEXMO_API_SECRET,
    applicationId: process.env.NEXMO_APPLICATION_ID,
    privateKey: process.env.NEXMO_APPLICATION_PRIVATE_KEY
});

app.post('/webhooks/inbound-message', (req, res) => {

    // swap 'to' and 'from' to respond to the message
    const from = req.body.to.id;
    const to = req.body.from.id;

    const content = req.body.message.content;

    // User has sent location from FB Messenger mobile app
    if (content.type === 'location') {
        getPostboxLocations(content.location.lat, content.location.long).then((results) => {
            processCSV(results).then((nearest) => {
                sendMessage(from, to, generateMapLink(nearest));
            }, (error) => {
                sendMessage(from, to, error);
            });
        }, (error) => {
            sendMessage(from, to, error);
        });
    // User has sent address which needs geocoding
    } else if(content.type === 'text') {
        geocodeAddress(content.text).then((address) => {
            getPostboxLocations(address.latitude, address.longitude).then((results) => {
                processCSV(results).then((nearest) => {
                    sendMessage(from, to, generateMapLink(nearest));
                }, (error) => {
                    sendMessage(from, to, error);
                });
            }, (error) => {
                sendMessage(from, to, error);
            });
        }, (error) => {
            sendMessage(from, to, error);
        });
    }
    res.status(200).end();
});

app.post('/webhooks/message-status', (req, res) => {
    console.log(req.body);
    res.status(200).end();
});

const generateMapLink = (nearest) => {
    let msg = '';
    const mapUrl = 'https://www.google.com/maps/search/?api=1';

    // Check to see if lat/lng pair was generated
    if (typeof nearest.latitude === 'undefined') {
        msg = 'No location provided!';
    } else {
        msg = `Your nearest postcode is here: ${mapUrl}&query=${nearest.latitude},${nearest.longitude}`;
    }
    return msg;
};

const getPostboxLocations = (lat, lon) => {
    return new Promise((resolve, reject) => {
        const postboxUrl = 'http://dracos.co.uk/made/locating-postboxes/nearest/?format=csv';
        request(`${postboxUrl}&lat=${lat}&lon=${lon}`, (error, response, body) => {
            if (error) {
                reject('Unable to locate postboxes!');
            } else {
                resolve(body);
            }
        });
    });
};

const geocodeAddress = (addressToGeocode) => {
    return new Promise((resolve, reject) => {
        const geocodeUrl = 'https://eu1.locationiq.com/v1/search.php?countrycodes=gb&limit=1&format=json';
        const queryAddress = encodeURI(addressToGeocode);
        request(`${geocodeUrl}&key=${process.env.LOCATIONIQ_API_KEY}&q=${queryAddress}`, (error, response, body) => {
            if (error) {
                // Something went wrong in the call to the geocoding servie
                reject(error);
            } else {
                const obj = JSON.parse(body);
                // No results returned
                if (obj.error) {
                    reject('Unable to find that address!');
                    // Retrieve map coordinates from the results
                } else {
                    let lat = obj[0].lat;
                    let lon = obj[0].lon;
                    resolve({
                        latitude: lat,
                        longitude: lon
                    });
                }
            }
        });
    });
};

const processCSV = (csv) => {
    return new Promise((resolve, reject) => {
        if (csv.length == 0) {
            reject('No results found!');
        } else {
            const content = csv.split('\n');
            const firstRow = content[1].split(',');
            const result = {
                postcode: firstRow[0],
                latitude: firstRow[1],
                longitude: firstRow[2],
                distance: firstRow[3],
                last: firstRow[4],
                first: firstRow[5]
            };
            resolve(result);
        }
    });
};

const sendMessage = (from, to, message) => {
    nexmo.channel.send(
        { 'type': 'messenger', 'id': to },
        { 'type': 'messenger', 'id': from },
        {
            'content': {
                'type': 'text',
                'text': message
            }
        },
        (err, data) => { console.log(`Message ID: ${data.message_uuid}`); }
    );
};

app.listen(3000);
