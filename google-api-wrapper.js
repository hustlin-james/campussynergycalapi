var gcal = require('google-calendar');

var GoogleEvents = function(){
};

//Synchronous events retrieval
GoogleEvents.prototype.getAllGoogleEventsSerially = function(accessToken,callback){

    var tasks = [];
    var buffer = [];
    
    var firstTask = function(){
      gcal(accessToken).calendarList.list(function(err, data) {

        var calIds = [];
        if(err) {
          //return res.send(500,err);
          console.log("error retrieving the calendar list");
          callback(err, null);

        }else{
          //Get all the calendar ids
          for(var i = 0; i < data.items.length; i++){
              var calId = data.items[i].id;
              calIds.push(calId);
          }

          //Go through the calendar ids and get the events
          for(var i = 0; i < calIds.length; i++){
              var calId = calIds[i];
              var task = (function(calId, accessToken){
                  return function(){
                      gcal(accessToken).events.list(calId,function(err,data){
                          //console.log(data);
                          next(data.items);  
                      });
                  };
              })(calId, accessToken);
              tasks.push(task);
          }

          next();
        }  
      });
    }

    function next(data){
        if(data)
            buffer.push(data);
        
        var currentTask = tasks.shift();
        if(currentTask){
            currentTask();
        }else{
            if(typeof callback === 'function'){
             callback(null, buffer);   
            }
        }
    }
    firstTask();
}

exports.googleEvents = function(){
    return new GoogleEvents();
};
