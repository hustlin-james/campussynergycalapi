campussynergycalapi
===================

stand alone api for facebook and google calendar events for campus synergy.  This way things will be more modular.

Need a config.js file with the following info

    module.exports = {
        google_consumer_key:'',
        google_consumer_secret:'',
        google_devCallbackUrl:'',
        google_prodCallbackUrl:'',
    
        facebook_app_id:'',
        facebook_app_secret:'',
        facebook_devCallbackUrl: '',
        facebook_prodCallbackUrl: ''
    }
