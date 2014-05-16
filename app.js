var express = require('express');
var http = require('http');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var fs = require('fs');

var routes = require('./routes');
var users = require('./routes/user');

//Google cal stuff
var googleEvents = require('./google-api-wrapper').googleEvents();
var config = require('./config');
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
var passport = require('passport');

var tokensDir='./tokens';
var googleCallbackUrl = config.google_devCallbackUrl;

//facebook events stuff
var fb=require('fb');
var facebook_app_id = config.facebook_app_id;
var facebook_app_secret = config.facebook_app_secret;
var facebookCallbackUrl = config.facebook_devCallbackUrl;

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(passport.initialize());
app.use(app.router);

//config checking
if(!config.google_consumer_key || !config.google_consumer_secret || !googleCallbackUrl)
    throw new Error('check google consumer key, secret, or callback');

if(!config.facebook_app_id || !config.facebook_app_secret || !facebookCallbackUrl){
  throw new Error('check facebook api id and secret and callback');
}else{
  facebookCallbackUrl='http://localhost:3000'+facebookCallbackUrl
}

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'dev') {
    app.use(function(err, req, res, next) {
        res.render('error', {
            message: err.message,
            error: err
            //error:{}
        });
    });
}
else{
    // production error handler
    // no stacktraces leaked to user
    callbackUrl = config.google_prodCallbackUrl;
    app.use(function(err, req, res, next) {
        res.render('error', {
            message: err.message,
            error: {}
        });
    });
}

/// catch 404 and forwarding to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});


//google cal setup
passport.use(
function(){
        
      return new GoogleStrategy({
        clientID: config.google_consumer_key,
        clientSecret: config.google_consumer_secret,
        callbackURL: googleCallbackUrl,
        scope: ['openid', 'email', 'https://www.googleapis.com/auth/calendar'] 
      },
      function(accessToken, refreshToken, profile, done) {
        profile.accessToken = accessToken;
        return done(null, profile);
      }
    )
}());

app.get('/google_auth',passport.authenticate('google', { session: false }));

app.get('/google_oauth2callback', 
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  function(req, res) { 
    //req.session.access_token = req.user.accessToken;
    //console.log(req.session.access_token);
    var accessToken = req.user.accessToken;
    fs.writeFileSync('accessTokenFile', accessToken);
    res.redirect('/');
});

//app.get('/', routes.index);
app.get('/all_google_calendars', function(req, res){
  /*
  var accessToken = fs.readFileSync('accessTokenFile').toString();
  gcal(accessToken).calendarList.list(function(err, data) {
    if(err) 
        return res.send(500,err);
    var result = [];
    for(var i = 0; i < data.items.length; i++){
        result.push({
            id: data.items[i].id,
            summary: data.items[i].summary
        });
    }
    return res.send(result);
  });
  */

  res.send('end');
});

app.get('/allGoogleEvents', function(req,res){
   var accessToken = fs.readFileSync('accessTokenFile').toString();

   console.log('getting all google events serially');

   googleEvents.getAllGoogleEventsSerially
    (accessToken, function(err,data){
      //result is array this may look strange but it is because of 
      //multiple calendars
      var allEventsFiltered = [];
      for(var i = 0; i < data.length; i++){
        allEventsFiltered.push(googleEventsFilter(data[i]));
      }
      res.send(allEventsFiltered);
    });
  
});

app.get('/facebook_auth', function(req,res){
  var accessTokenFile = 'fb_accessToken';
  var accessToken='';

  if(fs.exists(accessTokenFile))
    accessToken= fs.readFileSync(accessTokenFile);

  if(accessToken){
    res.redirect('/all_facebook_events');
  }else{
    var opts = {
      appId: facebook_app_id,
      scope: 'user_about_me,user_events',
      redirectUri: facebookCallbackUrl
    };
    var fbLoginUrl = fb.getLoginUrl(opts);
    res.redirect(fbLoginUrl);
  }
  //res.send('this should redirect to the facebook log in');
});

app.get('/facebook_callback', function(req,res){

  var code = req.query.code;
  //console.log('code: '+code);

  if(req.query.error) {
    // user might have disallowed the app
    return res.send('login-error ' + req.query.error_description);
  }else if(!code) {
    return res.redirect('/facebook_auth');
  }

  fb.napi('oauth/access_token', {
    client_id:facebook_app_id,
    client_secret:facebook_app_secret,
    redirect_uri:facebookCallbackUrl,
    code:code
  }, function(err,result){

      if(err)
        throw(err);

      fb.napi('oauth/access_token', {
        client_id:facebook_app_id,
        client_secret:facebook_app_secret,
        grant_type:         'fb_exchange_token',
        fb_exchange_token:  result.access_token
      }, function(err, result){
          var accessToken = result.access_token;

          var accessTokenFile = 'fb_accessToken';
          fs.writeFileSync(accessTokenFile, accessToken);

          res.redirect('/all_facebook_events');
      });
  });

});

app.get('/all_facebook_events', function(req,res){
  //res.send('this is all facebook events');
  var accessTokenFile = 'fb_accessToken';

  if(fs.existsSync(accessTokenFile)){

     var accessToken = fs.readFileSync(accessTokenFile).toString();
     console.log('accessToken: '+accessToken);
     fb.api('me', {
        fields:         'events',
        limit:          250,
        access_token:   accessToken
      }, function (result) {
          if(!result || result.error) {

              console.log(result.error ? result.error : result);
              return res.send(500, 'error');
          }
          res.send(result);
      });
  }
});

// ? may not be there
//bldName
//duration
//title 
//longDescription (summary)
//publisher (creator.email)
//roomString (location ?)

function googleEventsFilter(events){
    var eventsFilter = [];
    var i = 0; 
    
    for(; i < events.length; i++){
        
        var e = {};
        e.summary = "";
        e.publisher ="";
        e.location = "";
        
        if(events[i].summary)
            e.summary = events[i].summary;
        
        if(events[i].creator && events[i].creator.email)
            e.publisher = events[i].creator.email;
        
        if(events[i].location)
            e.location = events[i].location;
        
        eventsFilter.push(e);
    }
    
    return eventsFilter;
}

app.get('/', function(req,res){
    res.send('index page');
});

module.exports = app;