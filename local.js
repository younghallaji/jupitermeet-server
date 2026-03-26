/*jshint esversion: 6 */
/*jshint node: true */
"use strict";

require('dotenv').config();

const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const fetchSettings = require('./setting');

(async () => {
    const setting = await fetchSettings();

    const io = require('socket.io')(server, {
        cors: {
            origin: [
                process.env.DOMAIN,
                process.env.DOMAIN.replace('https://', 'http://'),
                process.env.DOMAIN.replace('http://', 'https://')
            ]
        }
    });
    const listner = server.listen(setting.port, function () {
        console.log('Listening on', listner.address().port);
    });

    require('./socket')(io, setting);
    require('./forceMute')(io);
    require('./videoSync')(io);

    app.get('/', function (req, res) {
        res.send('Ok');
    });

})();