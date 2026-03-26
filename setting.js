const fetch = require('node-fetch').default;

async function settings() {
    const res = await fetch(process.env.DOMAIN + '/get-nodejs-details', {
        headers: {
            'X-Api-Token': process.env.SIGNALING_TOKEN
        }
    });
    const result = await res.json();

    if(result.success){
        return result.data;
    } else{
        throw new Error('Failed to fetch settings from server');
    }

}

module.exports = settings;