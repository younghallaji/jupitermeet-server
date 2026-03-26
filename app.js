/*jshint esversion: 6 */
/*jshint node: true */
"use strict";

require('dotenv').config();

const express = require('express');
const app = express();
const fs = require('fs');
const fetchSettings = require('./setting');

(async () => {
	const setting = await fetchSettings();

	const options = {
		key: fs.readFileSync(setting.keyPath),
		cert: fs.readFileSync(setting.certPath)
	};
	const https = require('https').Server(options, app);
	const io = require('socket.io')(https, {
		cors: {
			origin: process.env.DOMAIN //allow only the specified domain to connect
		}
	});
	const listner = https.listen(setting.port, function () {
		console.log('Listening on ', listner.address().port);
	});

	require('./socket')(io, setting);
	require('./forceMute')(io);
	require('./videoSync')(io);

	app.get('/', function (req, res) {
		res.send('Ok');
	});

})();
