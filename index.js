'use strict';
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const http = require('http');
const request = require('request');

const Nexmo = require('nexmo')

const nexmo = new Nexmo({
    apiKey: '7c47a82b',
    apiSecret: 'Mg5AHLqxhSBH77s1',
    applicationId: 'a5c4e5af-3d84-40ed-8366-b082beeeeefd',
    privateKey: 'private.key'
})

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/webhooks/inbound-message', (req, res) => {
    console.log(req.body.message);
    let userLat, userLong = null;

    // swap 'to' and 'from' to return the message
    let from = req.body.to.id;
    let to = req.body.from.id;

    // Get latitude and longitude
    if (req.body.message.content.location) {
        userLat = req.body.message.content.location.lat;
        userLong = req.body.message.content.location.long;

        getPostboxLocations(userLat, userLong).then((results) => {
            processCSV(results).then((nearest) => {
                sendMessage(from, to, generateMapLink(nearest));
            }, (error) => {
                sendMessage(from, to, error);
            })
        }, (error) => {
            sendMessage(from, to, error);
        })

    } else {
        geocodeAddress(req.body.message.content.text).then((address) => {
            getPostboxLocations(address.latitude, address.longitude).then((results) => {
                processCSV(results).then((nearest) => {
                    sendMessage(from, to, generateMapLink(nearest))
                }, (error) => {
                    sendMessage(from, to, error)
                })
            }, (error) => {
                sendMessage(from, to, error)
            })
        }, (error) => {
            sendMessage(from, to, error);
        })

    }
    res.status(200).end();
});

app.post('/webhooks/message-status', (req, res) => {
    //console.log(req.body);
    res.status(200).end();
});

const generateMapLink = (nearest) => {
    let msg = '';
    if (isEmpty(nearest)) {
        msg = 'No location provided!';
    } else {
        msg = `Your nearest postcode is here: https://www.google.com/maps/search/?api=1&query=${nearest.latitude},${nearest.longitude}`;
    }
    return msg;
}

const getPostboxLocations = (lat, lon) => {
    console.log('userlat: ' + lat);
    console.log('userlong: ' + lon);
    return new Promise((resolve, reject) => {
        request(`http://dracos.co.uk/made/locating-postboxes/nearest/?format=csv&lat=${lat}&lon=${lon}`, (error, response, body) => {
            if (error) {
                reject('Unable to locate postboxes!');
            } else {
                resolve(body);
            }
        });
    });
}

const geocodeAddress = (addressToGeocode) => {
    return new Promise((resolve, reject) => {
        console.log('geocoding ' + addressToGeocode);
        const queryAddress = encodeURI(addressToGeocode);
        request(`https://eu1.locationiq.com/v1/search.php?key=e406a750e93823&q=${queryAddress}&countrycodes=gb&limit=1&format=json`, (error, response, body) => {
            if (error) {
                reject(error);
            } else {
                const obj = JSON.parse(body)
                if (obj.error) {
                    reject('Unable to find that address!');
                } else {
                    let lat = obj[0].lat;
                    let lon = obj[0].lon
                    resolve({
                        latitude: lat,
                        longitude: lon
                    });
                }

            }
        });
    });
}

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
            }
            console.dir(result);
            resolve(result);
        }

    })
}

const sendMessage = (from, to, message) => {
    nexmo.channel.send(
        { "type": "messenger", "id": to },
        { "type": "messenger", "id": from },
        {
            "content": {
                "type": "text",
                "text": message
            }
        },
        (err, data) => { console.log(data.message_uuid); }
    );
}

const isEmpty = (obj) => {
    for (var key in obj) {
        if (obj.hasOwnProperty(key))
            return false;
    }
    return true;
}

//https://www.google.com/maps/search/?api=1&query=52.02982930157,-1.14653394918176
//https://www.google.com/maps/search/?api=1&query=52.0296303682203,-1.14637739820219

app.listen(5000)
