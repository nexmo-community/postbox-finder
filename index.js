'use strict';
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const Nexmo = require('nexmo');

const nexmo = new Nexmo({
    apiKey: '7c47a82b',
    apiSecret: 'Mg5AHLqxhSBH77s1',
    applicationId: 'a5c4e5af-3d84-40ed-8366-b082beeeeefd',
    privateKey: 'private.key'
});

app.post('/webhooks/inbound-message', (req, res) => {
    //console.log(req.body.message);

    // swap 'to' and 'from' to return the message
    const from = req.body.to.id;
    const to = req.body.from.id;

    const content = req.body.message.content;

    // Get latitude and longitude
    if (content.location) {
        getPostboxLocations(content.location.lat, content.location.long).then((results) => {
            processCSV(results).then((nearest) => {
                sendMessage(from, to, generateMapLink(nearest));
            }, (error) => {
                sendMessage(from, to, error);
            });
        }, (error) => {
            sendMessage(from, to, error);
        });

    } else {
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
    //console.log(req.body);
    res.status(200).end();
});

const generateMapLink = (nearest) => {
    let msg = '';

    // Check to see if lat/lng pair was generated
    if (typeof nearest.latitude === 'undefined') {
        msg = 'No location provided!';
    } else {
        msg = `Your nearest postcode is here: https://www.google.com/maps/search/?api=1&query=${nearest.latitude},${nearest.longitude}`;
    }
    return msg;
};

const getPostboxLocations = (lat, lon) => {
    return new Promise((resolve, reject) => {
        request(`http://dracos.co.uk/made/locating-postboxes/nearest/?format=csv&lat=${lat}&lon=${lon}`, (error, response, body) => {
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
        const queryAddress = encodeURI(addressToGeocode);
        request(`https://eu1.locationiq.com/v1/search.php?key=e406a750e93823&q=${queryAddress}&countrycodes=gb&limit=1&format=json`, (error, response, body) => {
            if (error) {
                // Something went wrong in the call to the geocoding servie
                reject(error);
            } else {
                const obj = JSON.parse(body);
                // No results returned
                if (obj.error) {
                    reject('Unable to find that address!');
                    // Results returned
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

app.listen(5000);
