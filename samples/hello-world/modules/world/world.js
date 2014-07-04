// initialize the app
module.exports = function(imports) {
  var router = imports.core.router;
  // registers a new module
  return {
    plugin: {
      world: {
        on: {
          ready: function() {
            router.get(
              '/', function(req, res) {
              res.end('Hello World - from hello');
            });
          }
        }
      }
    }
  };
};