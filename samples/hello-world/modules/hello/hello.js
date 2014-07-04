// initialize the app
module.exports = function(imports) {
  var router = imports.core.router;
  return {
    plugin: {
      hello: {
        on: {
          ready: function() {
            router.get('/', function(req, res) {
              res.end('Hello World - from hello');
            });
          }
        }
      }
    }
  };
};