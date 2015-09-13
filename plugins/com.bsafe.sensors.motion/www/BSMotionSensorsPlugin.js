var exec = require('cordova/exec'),
    latestReading = null,
    listeners = [],
    timer = null;

function command(name, success, error) {
    var pluginName = 'BSMotionSensorsPlugin',
        blankFunc = function() {};

    success = success || blankFunc;
    error = error || blankFunc;

    exec(success, error, pluginName, name, []);
}

function bindListener(listener) {
    if(typeof(listener) !== typeof(Function)) {
        throw '`listener` is not a function. Cannot bind';
    }

    listeners.push(listener);
}

function callListeners() {
    for(var i = 0; i < listeners.length; i++) {
        var listener = listeners[i];

        if(typeof(listener) === typeof(Function)) {
            listener(latestReading);
        }
    }
}

exports.getList = function(success, error) {
    command('getList', success, error);
};

exports.start = function(onReading, error, frequency) {
    bindListener(onReading);
    command('start', function(reading) {
        latestReading = reading;
    }, error);

    timer = setInterval(callListeners, frequency || 300);
};

exports.stop = function() {
    command('stop');
    clearInterval(timer);
};

exports.onReading = function(listener) {
    bindListener(listener);
}
