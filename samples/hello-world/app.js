
// initialize the application
var app = require('../../modulable')(
  // the application structure
  __dirname + '/package.json'
  // inject some application specific configuration
  , __dirname + '/config.json'
);

// run the application :
app
  // initialize each module
  .trigger('init')
  // and starts the app
  .trigger('start')
;
