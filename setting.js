const fetch = require('node-fetch').default;

async function settings() {
    const url = (process.env.APP_URL || process.env.DOMAIN) + '/get-nodejs-details';
    console.log('[settings] fetching:', url);

    const res = await fetch(url, {
        headers: {
            'X-Api-Token': process.env.SIGNALING_TOKEN
        }
    });

    console.log('[settings] HTTP status:', res.status);

    if (!res.ok) {
        const text = await res.text();
        console.error('[settings] non-OK response body:', text.slice(0, 300));
        throw new Error('Settings fetch failed with status ' + res.status);
    }

    const result = await res.json();

    if(result.success){
        return result.data;
    } else{
        throw new Error('Failed to fetch settings from server');
    }

}

module.exports = settings;