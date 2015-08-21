/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

function q(sel) {
  return document.querySelectorAll(sel);
}
var app = {
    // Application Constructor
    initialize: function() {
        this.bindEvents();
    },
    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },
    // deviceready Event Handler
    //
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicitly call 'app.receivedEvent(...);'
    onDeviceReady: function() {
        app.receivedEvent('deviceready');
    },
    // Update DOM on a Received Event
    receivedEvent: function(id) {
        console.log('Received Event: ' + id);
        switch(id) {
          case 'deviceready':
            app.bindHandlers();
            // server.start(function(base) {
            //   window.location.href = base;
            // });
        }
    },

    bindHandlers: function() {
      var ssButton = q('.ssButton')[0];
      ssButton.addEventListener('click', function() {
        geolocation.toggleRecording();
        compass.toggleRecording();
        accelerometer.toggleRecording();
      });
    }
};

var server = (function(G) {
  var httpd = null,
      base = '';

  return {
    start: function(callback) {
      try {
        httpd = cordova.plugins.CorHttpd;

        httpd.getURL(function(url) {
          // if url is an empty string, means server hasn't started yet.
          if(!url.length) {
            httpd.startServer({
              www_root: '',
              port: 8080,
              localhost_only: false

            }, function(url) {
              base = url;
              callback? callback(url) : '';
            }, function(err) {
              throw err;
            });
          }

        });
      }
      catch (err) {
        console.error(err);
      }
    },

    stop: function() {
      if(!httpd) throw 'Cannot stop the server that isn\'t running.';
      httpd.stopServer(function() {}, function(err) { throw err; });
    }
  }
})(this);


var accelerometer = {
  isRecording: false,
  watch: null,
  id: 34,
  readings: {
    x: [],
    y: [],
    z: [],
    abs: []
  },

  graphs: {
    x: null,
    y: null,
    z: null,
    abs: null
  },

  startRecording: function() {
    if(this.isRecording === true) return;

    // Starting accelerometer
    this.id = parseInt(Math.random()*1000000);
    this.watch = navigator.accelerometer.watchAcceleration(this.gotReading.bind(this), this.onError, {
      frequency: 200
    });

    // Initializing the graph
    // // x-axis
    // this.graphs.x = new CanvasJS.Chart('acc-graph-x', {
    //   title: {
    //     text: 'X Axis'
    //   },
    //   data: [{
    //     type: 'line',
    //     dataPoints: this.readings.x
    //   }],
    //   axisY: {
    //     minimum: -20,
    //     maximum: 20
    //   }
    // });
    //
    // // y-axis
    // this.graphs.y = new CanvasJS.Chart('acc-graph-y', {
    //   title: {
    //     text: 'Y Axis'
    //   },
    //   data: [{
    //     type: 'line',
    //     dataPoints: this.readings.y
    //   }],
    //   axisY: {
    //     minimum: -20,
    //     maximum: 20
    //   }
    // });
    //
    // // z-axis
    // this.graphs.z = new CanvasJS.Chart('acc-graph-z', {
    //   title: {
    //     text: 'Z Axis'
    //   },
    //   data: [{
    //     type: 'line',
    //     dataPoints: this.readings.z
    //   }],
    //   axisY: {
    //     minimum: -20,
    //     maximum: 20
    //   }
    // });

    this.graphs.abs = new CanvasJS.Chart('acc-graph-abs', {
      title: {
        text: 'Absolute Force'
      },
      data: [{
        type: 'line',
        dataPoints: this.readings.abs
      }],
      axisY: {
        minimum: -20,
        maximum: 20
      }
    });

    // this.graphs.x.render();
    // this.graphs.y.render();
    // this.graphs.z.render();
    this.graphs.abs.render();

    this.isRecording = true;
  },

  stopRecording: function() {
    if(this.isRecording === false) return;
    this.id = 34;
    // clear watch
    navigator.accelerometer.clearWatch(this.watch);
    this.isRecording = false;
  },

  toggleRecording: function() {
    if(typeof(this.isRecording) === 'undefined') {
      alert('this is not accelerometer object');
      return;
    }
    if(this.isRecording) this.stopRecording();
    else this.startRecording();
  },

  gotReading: function(acc) {
    var pushReadings = function(axis, value) {
      var readings = this.readings[axis],
          t = acc.timestamp;

      value = value || acc[axis];

      readings.push({
        x: t,
        y: value
      });

      if(readings.length > 100) readings.shift();
      this.graphs[axis].render();
    };
    // q('.acc-output')[0].innerHTML = JSON.stringify(acc);

    var geo = geolocation.currentPosition,
        comp = compass.currentHeading;

    $.post('http://192.168.1.3:3000/', {
      accX: acc.x,
      accY: acc.y,
      accZ: acc.z,
      geoLat: geo.latitude,
      geoLong: geo.longitude,
      geoAccu: geo.accuracy,
      geoAlt: geo.altitude,
      geoAltAccu: geo.altitudeAccuracy,
      geoHeading: geo.heading,
      geoSpeed: geo.speed,
      compMagHeading: comp.magneticHeading,
      compTrueHeading: comp.trueHeading,
      compAccu: comp.headingAccuracy,
      timeStamp: acc.timestamp,
      rideID: this.id
    }, function(data) {
      $('.acc-post-resp').html(data);
    });

    // push to readings
    // pushReadings.bind(this)('x');
    // pushReadings.bind(this)('y');
    // pushReadings.bind(this)('z');
    var absoluteForce = Math.sqrt(acc.x*acc.x + acc.y*acc.y + acc.z*acc.z) - 9.8;
    pushReadings.bind(this)('abs', absoluteForce);
  },

  onError: function(err) {
    alert(err);
  }
};

var geolocation = {
  isRecording: false,
  currentPosition: null,
  startRecording: function() {
    if(this.isRecording === true) return;

    this.watch = navigator.geolocation.watchPosition(this.gotPosition.bind(this), this.onError, {
      enableHighAccuracy: true,
      maximumAge: 3000
    });
    this.isRecording = true;
  },

  stopRecording: function() {
    if(this.isRecording === false) return;

    navigator.geolocation.clearWatch(this.watch);
    this.currentPosition = null;
    this.isRecording = false;
  },

  toggleRecording: function() {
    if(typeof(this.isRecording) === 'undefined') {
      alert('this is not geolocation object');
      return;
    }

    if(this.isRecording) this.stopRecording();
    else this.startRecording();
  },

  gotPosition: function(pos) {
    this.currentPosition = pos;
    console.log(pos);
  },

  onError: function(err) {
    throw err;
  }
};

var compass = {
  isRecording: false,
  currentHeading: null,

  startRecording: function() {
    if(this.isRecording === true) return;

    this.watch = navigator.compass.watchHeading(this.gotReading.bind(this), this.onError, {
      frequency: 200
    });

    this.isRecording = true;
  },

  stopRecording: function() {
    if(this.isRecording === false) return;

    navigator.compass.clearWatch(this.watch);
    this.isRecording = false;
  },

  toggleRecording: function() {
    if(typeof(this.isRecording) === 'undefined') {
      alert('this is not compass object');
      return;
    }

    if(this.isRecording) this.stopRecording();
    else this.startRecording();
  },

  gotReading: function(heading) {
    this.currentHeading = heading;
    console.log(heading);
  },

  onError: function(err) {
    throw err;
  }
};
