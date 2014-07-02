
var path = require('path');
var _    = require('extend');
var fs   = require('fs');

/**
 * Resolving a configuration instance
 * @params String|Object 
 * @return Object
 */
function resolveConf(instance) {
  if (typeof instance === 'string') instance = require(instance);
  if (instance.hasOwnProperty('modulable')) {
    if (!instance.modulable.hasOwnProperty('name') && instance.hasOwnProperty('name')) {
      instance.modulable.name = instance.name;
    }
    if (!instance.modulable.hasOwnProperty('main')) {
      if (instance.hasOwnProperty('main')) {
        instance.modulable.main = instance.main;
      } else {
        instance.modulable.main = 'main.js';
      }
    }
    if (instance.modulable.hasOwnProperty('using') && instance.hasOwnProperty('dependencies')) {
      _(true, instance.modulable.using, instance.dependencies);
    }
    instance = instance.modulable;
  }
  return instance;
}

/**
 * Tiny class helper
 */
function declare(fn, structure){
  var def = {};
  for(var i in structure) {
    def[i] = structure[i];
  }
  fn.prototype = def;
  fn.prototype.constructor = fn;
  return fn;
};

/**
 * Application structure : handles module containers
 */
var app = declare(
  // constructor
  function(package, config) {

    // working directory
    this.path.root = process.cwd();

    if (typeof package === 'string') {
      // relative to json file (if set)
      this.path.root = path.dirname(package);
    }

    // reads the configuration
    package = resolveConf(package);

    // gets the modules root path
    this.path.modules =  path.resolve(
      this.path.root, 
      package.path || './modules'
    );

    // initialize configuration
    this.configure(config || {});

    // loads each module
    var modules = [];
    for(var module in package.using) {
      module = this.load(module);
      if (module) {
        modules.push(module);
      }
    }

    // 

  }, {

    // list of plugin containers
    containers: {}

    // configuration
    ,config: {}

    // path configuration
    ,path: [
      // working directory
      root: null
      // modules root directory
      ,modules: null
    }

    /**
     * Iterate over each container
     * @returns {app}
     */
    ,each: function(cb) {
      for(var i in this.containers) {
        cb(this.containers[i]);
      }
      return this;
    }

    /**
     * Retrieves a modules container by its type
     * @param {String} name
     * @return {container|plugin}
     */
    ,get: function(name) {
      name = name.split('.', 2);
      if (!this.containers.hasOwnProperty(name[0])) {
        throw new Error('Undefined container type : ' + name[0]);
      }
      return name.length === 2 ? this.containers[name[0]].get(name[1]) : this.containers[name[0]];
    }

    /**
     * Starts to use the specified module
     * @params String The module name (directory name)
     * @params String The full location to the package.json file
     */
    ,load: function(module, package) {
      var basedir = this.path.modules + '/' + module;
      if (!package) {
        if (!fs.existsSync(basedir + '/package.json')) {
          // fallback on node_modules from npm
          basedir = this.path.root + '/node_modules/' + module;
        }
        package = basedir + '/package.json';
      } else {
        basedir = path.dirname(package);
      }

      // require the package.json
      if (!fs.existsSync(package)) {
        if (fs.existsSync(basedir)) {
          throw new Error('Unable to locate the package.json file for module ' + module + ' ! Try "npm update" to update your modules ...');
        } else {
          throw new Error('Unable to locate module ' + module + ' ! Try "npm install ' + module + '" ...');
        }
      }
      package = require(package);

      // check if it's a modulable package, and if not ignore it
      if (
        package && package.hasOwnProperty('modulable') && (
          // if a package does not provides or consume anything, leave it alone and ignore it
          package.modulable.hasOwnProperty('provides')
          || package.modulable.hasOwnProperty('consumes')
        )
      ) {

        // resolve the package configuration
        package = resolveConf(package);

        // returns the package entry
        return {
          meta: package,
          path: basedir,
          init: require( path.resolve(basedir, package.main) )
        };
      }
    }

    /**
     * Registers a new module container
     * @param String|Object
     */
    ,register: function(module) {
    
      // if passing a module name, loads it
      if (typeof module === 'string') {
        var modConf = this.load(module);
        if (!modConf) {
          throw new Error('Unable to load "' + module + '" as a modulable component !');
        } else {
          module = modConf;
        }
      }
      
      
      
      return this;
    }

    /**
     * Retrieves a module
     * @params String The module name
     * @return Object
     */
    ,configure: function(options) {
      _(true, this.config, resolveConf(options));
      // send configuration notification to each component
      for(var i in this.config) {
        if (this.containers.hasOwnProperty(i)) {
          this.containers[i].configure(this.config[i]);
        }
      }
      return this;
    }

    /**
     * Triggers an event over the specified container
     */
    ,trigger: function(container, event, options) {
      if (!options && typeof event !== 'string') {
        options = event;
        event = null;
      }
      if (event) {
        this.get(container).trigger(event, options);
      } else {
        event = container;
        this.each(function(container) {
          container.trigger(event, options);
        });
      }
      return this;
    }
  }
);

// defines a plugin container
var container = declare(
  function(app, name, basepath) {
    this.name = name;
    this.path = basepath;
    // plugin modular interface
    this.modulable = {
      // registers a new plugin
      provides: function(container, pluginName) {
        if (!pluginName) {
          pluginName = container;
          container = name;
        }
        container = app.get(container);
        return container.register(
          pluginName, new plugin(container, pluginName)
        );
      }
      // extends an existing plugin
      ,extends: function(container, pluginName, cb) {
        if (!cb) {
          cb = pluginName;
          pluginName = container;
          container = name;
        }
        container = app.get(container);
        var parent = container.get(pluginName);
        var result = container.register(
          pluginName, new plugin(container, pluginName)
        );
        for(var i in parent) {
          if (parent.hasOwnProperty(i)) {
            result[i] = parent[i];
          }
        }
        cb.apply(result, [parent]);
        return result;
      }
      // provides a new plugin container
      ,handles: function(container, path) {
        return app.register(container, path).get(container);
      }
    };
    /**
     * Loads the specified package
     */
    this.load = function(name) {
      var basedir = this.path + "/" + name;
      var package = require(basedir + '/package.json');
      var context = this;
      // resolve imports
      var imports = {};
      if ( package.modulable.hasOwnProperty('imports') ) {
        for(var i in package.modulable.imports) {
          var imp = package.modulable.imports[i].split('.', 2);
          var k;
          var j;
          if (imp.length == 2) {
            k = imp[0];
            j = imp[1];
            imp = app.get(imp[0]).get(imp[1]);
          } else {
            k = name;
            j = imp[0];
            imp = this.get(imp[0]);
          }
          if (!imports.hasOwnProperty(k)) imports[k] = {};
          imports[k][j] = imp;
        }
      }
      // run the package
      try {
        var cb = require(path.resolve(basedir, package.main));
      } catch(e) {
        throw new Error(this.name + '/' + name + ' error ' + e.message + "\n\n** Caused by : " + e.stack + "\n\n--- Final error :");
      }
      cb(imports, this.modulable);
    };
  }, {
    instances: {},
    modules: [],
    name: null,
    path: null,
    config: {},
    /**
     * Configures each module
     */
    configure: function(options) {
      _(true, this.config, options);
      
    },
    /**
     * Gets the container type name
     * @return String
     */
    type: function() {
      return this.name;
    },
    /**
     * Gets/Sets the loading path for lookups
     */
    path: function(value) {
      if (value) {
        this.path = value;
      }
      return this.path;
    },
    /**
     * Registers a structure
     */
    register: function(name, instance) {
      if (!this.instances.hasOwnProperty(name)) {
        this.modules.push(name);
      }
      this.instances[name] = instance;
      return instance;
    },
    /**
     * Gets a plugin from its name
     */
    get: function(plugin) {
      if (!this.instances.hasOwnProperty(plugin)) {
        throw new Error('Undefined plugin : ' + this.name + '.' + plugin);
      }
      return this.instances[plugin];
    },
    // iterator
    each: function(cb) {
      for(var i in this.modules) {
        cb(this.instances[this.modules[i]]);
      }
      return this;
    },
    /**
     * triggers an event over each registered plugin
     */
    trigger: function(event, options) {
      return this.each(function(plugin) {
        plugin.trigger(event, options);
      });
    }
  }
);

// the module definition 
var plugin = declare(
  function(container, name, config) {
    this.name = name;
    this.config(config);
  }, {
    config: {}
    ,events: {}
    // adds some configuration
    ,configure: function(options) {
      _(true, this.config, options);
      return this
    }
    // listen an event
    ,on: function(event, cb) {
      if (!this.events.hasOwnProperty(event)) {
        this.events[event] = [];
      }
      this.events[event].push(cb);
      return this;
    }
    // triggers an event with specified options
    ,trigger: function(event, options) {
      if (this.events.hasOwnProperty(event)) {
        var cb = this.events[event];
        for(var i in cb) {
          cb[i].apply(this, [options]);
        }
      }
      return this;
    }
    // defines a new method
    ,method: function(name, cb) {
      this[name] = cb;
      return this;
    }
  }
);

// expose api : creates a new application instance
module.exports = function(package, config) {
  return new app(package, config);
};