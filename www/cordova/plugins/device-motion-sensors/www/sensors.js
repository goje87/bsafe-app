var sensors = {
  shout: function(message) {
    message = message || 'fuck ya!';

    window.alert(message);
  }
};

module.exports = sensors;
