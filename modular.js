var path = require('path');
var _    = require('lodash');

/**
 * Resolving a configuration instance
 * @params String|Object 
 * @return Object
 */
function resolveConf(instance) {
  if (typeof instance === 'string') {
    instance = require(instance);
  }
  if (instance.hasOwnProperty('modular')) {
    if (
      !instance.modular.hasOwnProperty('name')
      && instance.hasOwnProperty('name')
    ) {
      instance.modular.name = instance.name;
    }
    instance = instance.modular;
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
    var root = process.cwd();
    if (typeof package === 'string') {
      // relative to json file (if set)
      root = path.dirname(package);
    }

    // reads the configuration
    package = resolveConf(package);

    // initialize configuration
    if (typeof config === 'string') {
      config = resolveConf(config);
    }
    this.config = config;

    // initialize containers
    for(var i in package.contains) {
      this.register(
        i
        , path.resolve(root, package.contains[i])
      );
    }

    // initialize modules
    for(var container in package.using) {
      for(var module in package.using[container]) {
        this.get(container).load(module);
      }
    }
    
  }, {
    // list of plugin containers
    containers: {}
    // configuration
    ,config: {}
    /**
     * Iterate over each container
     * @returns {app}
     */
    ,each: function(cb) {
      for(var i in this.containers) {
        cb(this.containers[i]);
      }
      return this;
    },
    /**
     * Retrieves a modules container by its type
     * @param {String} name
     * @return {container}
     */
    get: function(name) {
      if (!this.containers.hasOwnProperty(name)) {
        throw new Error('Undefined container type : ' + name);
      }
      return this.containers[name];
    },
    /**
     * Registers a new module container
     * @param Object
     * @return {container}
     */
    register: function(name, path, options) {
      if (this.config.hasOwnProperty(name)) {
        options = _.merge(this.config[name], options);
      }
      if (this.containers.hasOwnProperty(name)) {
        this.containers[name].path(path);
      } else {
        this.containers[name] = new container(this, name, path);
      }
      this.containers[name].configure(options);
      return this;
    }
    /**
     * Retrieves a module
     * @params String The module name
     * @return Object
     */
    ,configure: function(options) {
      this.config = _.merge(this.config, resolveConf(options));
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
    this.modular = {
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
      if ( package.modular.hasOwnProperty('imports') ) {
        for(var i in package.modular.imports) {
          var imp = package.modular.imports[i].split('.', 2);
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
      cb(imports, this.modular);
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
      this.config = _.merge(this.config, options);
      
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
    ,config: function(options) {
      this.config = _.merge(this.config, options);
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