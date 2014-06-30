
// initialize the application
var app = require('../../modular')(
  // the application structure
  __dirname + '/package.json'
  // inject some application specific configuration
  , __dirname + '/config.json'
);

// run the application :
app
  // initialize the http mode
  .trigger('web', 'init')
  // initialize each plugin
  .trigger('plugin', 'start')
  // starts the application in http mode
  .trigger('web', 'start')
;
