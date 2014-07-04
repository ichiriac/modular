
// initialize the application
var app = require('../../modulable')(
  // the application structure
  __dirname + '/package.json'
  // inject some application specific configuration
  , __dirname + '/config.json'
);

// and starts the app
app.trigger('start');


console.log(require('util').inspect(app.containers));