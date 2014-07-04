
var path = require('path');
var sort = require('toposort');
var fs   = require('fs');
var _    = require('extend');

/**
 * Resolving a configuration instance
 * @params String|Object 
 * @return Object
 */
function resolveConf(instance) {
  if (typeof instance === 'string') instance = readJson(instance);
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
 * Helper for reading a JSON file
 */
function readJson(filename) {
  if (fs.existsSync(filename)) {
    try {
      return JSON.parse(fs.readFileSync(filename));
    } catch(e) {
      throw new Error('Parsing error in : ' + filename + '\n\nReason : ' + e.message);
    }
  } else {
    throw new Error('Unable to locate file : ' + filename);
  }
}
/**
 * Helper for listing an object properties
 */ 
function getProps(obj) {
  var result = [];
  for(var v in obj) {
    if (obj.hasOwnProperty(v)) result.push(v);
  }
  return result;
}

/**
 * Tiny class helper
 */
function declare(fn, structure) {
  fn.prototype = structure;
  fn.prototype.constructor = fn;
  return fn;
};

/**
 * Application structure : handles module containers
 */
var app = declare(
  // constructor
  function(package, config) {
    // list of plugin containers
    this.containers = {};

    // configuration
    this.config = {};

    // path configuration
    this.path = {
      // working directory
      root: null
      // modules root directory
      ,modules: null
    };
    
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

    // loads each module
    var modules = {};
    var edges = [];
    var provides = {};
    for(var module in package.using) {
      module = this.load(module);
      if (module) {
        modules[module.meta.name] = module;
        if (
          module.meta.plugin.hasOwnProperty('provides')
          && module.meta.plugin.provides.length > 0
        ) {
          for(var i in module.meta.plugin.provides) {
            i = module.meta.plugin.provides[i];
            if (provides.hasOwnProperty(i)) {
              throw new Error(
                "Module '" + module.meta.name + "' could not provide '" + i + "', service already provided by module '" + provides[i] + "'"
              );
            } else {
              provides[i] = module.meta.name;
            }
          }
        }
        if (
          (
            !module.meta.plugin.hasOwnProperty('consumes')
            || module.meta.plugin.consumes.length == 0
          ) && (
            !module.meta.plugin.hasOwnProperty('extends')
            || module.meta.plugin.extends.length == 0
          )
        ) {
          edges.push([module.meta.name, '*']);
        }
      }
    }

    // resolve dependencies
    for(var m in modules) {
      module = modules[m];
      if (module.meta.plugin.hasOwnProperty('consumes')) {
        for(var c in module.meta.plugin.consumes) {
          c = module.meta.plugin.consumes[c];
          if (!provides.hasOwnProperty(c)) {
            throw new Error(
              'Unable to resolve service dependency \''+c+'\' for module \'' + module.meta.name + '\''
            );
          }
          edges.push([provides[c], module.meta.name]);
        }
      }
      if (module.meta.plugin.hasOwnProperty('extends')) {
        for(var c in module.meta.plugin.extends) {
          c = module.meta.plugin.extends[c];
          if (!provides.hasOwnProperty(c)) {
            throw new Error(
              'Unable to resolve service dependency \''+c+'\' for module \'' + module.meta.name + '\''
            );
          }
          edges.push([provides[c], module.meta.name]);
        }
      }
    }
    edges = sort(edges); // sort

    // loading each module and its services
    for(var m = 0; m < edges.length; m++) {
      if (edges[m] != '*') {
        this.register(modules[edges[m]]);
      }
    }

    // initialize configuration
    this.configure(config || {});

    // all services are ready !
    this.trigger('ready');

  }, {

    /**
     * Iterate over each container
     * @returns {app}
     */
    each: function(cb) {
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
      package = readJson(package);

      // check if it's a modulable package, and if not ignore it
      if (
        package && package.hasOwnProperty('plugin') && (
          // if a package does not provides or consume anything, leave it alone and ignore it
          package.plugin.hasOwnProperty('provides')
          || package.plugin.hasOwnProperty('consumes')
        )
      ) {
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

      // prepare imports
      var imports = {};
      var expecting = {};
      if (module.meta.plugin.hasOwnProperty('consumes')) {
        for(var c in module.meta.plugin.consumes) {
          c = module.meta.plugin.consumes[c].split('.', 2);
          if (!imports.hasOwnProperty(c[0])) {
            imports[c[0]] = {};
          } 
          imports[c[0]][c[1]] = this.containers[c[0]].get(c[1]);
        }
      }
      if (module.meta.plugin.hasOwnProperty('extends')) {
        for(var c in module.meta.plugin.extends) {
          c = module.meta.plugin.extends[c];
          expecting[c] = true;
          c = c.split('.', 2);
          if (!imports.hasOwnProperty(c[0])) {
            imports[c[0]] = {};
          } 
          imports[c[0]][c[1]] = this.containers[c[0]].get(c[1]);
        }
      } else {
        module.meta.plugin.extends = [];
      }
      if (module.meta.plugin.hasOwnProperty('provides')) {
        for(var c in module.meta.plugin.provides) {
          c = module.meta.plugin.provides[c];
          expecting[c] = true;
        }
      }

      // gets the module definition
      var instance = module.init(imports);

      // register each service
      if (getProps(expecting).length > 0) {
        for(var c in instance) { 
          // container
          if (!this.containers.hasOwnProperty(c)) {
            this.containers[c] = new container(this, c);
          }
          for(var s in instance[c]) {
            var modName = c + '.' + s;
            if (!expecting.hasOwnProperty(modName)) {
              throw new Error(
                module.meta.name + ' error : undeclared "'+modName+'" service, must declare them with "provides" in the package.json file !' 
              );
            } else {
              expecting[modName] = false; // unflag
            }
            // service
            var service = instance[c][s];
            // check the service status
            if (module.meta.plugin.extends.indexOf(modName) > -1) {
              if(!this.containers[c].contains(s)) {
                throw new Error(
                  module.meta.name + ' error : could not extends "' + modName + '", undefined service !'
                );
              }
            } else if(this.containers[c].contains(s) ) { // try to define
              throw new Error(
                module.meta.name + ' error : could not define "' + modName + '", already defined by another module !'
              );
            }
            this.containers[c].register(s, service);
          }
        }
        // check if remain flags
        var remains = [];
        for(var c in expecting) {
          if (expecting[c]) remains.push(c); 
        }
        if (remains.length > 0) {
          throw new Error(
            module.meta.name + ' error : missing services declaration - ' + remains.join(', ') + ' !' 
          );
        }
      } else if (getProps(instance).length > 0) {
        throw new Error(
          module.meta.name + ' error : unable to export services, must declare them with "provides" in the package.json file !' 
        );
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
      // send configuration notification to each container
      for(var i in this.config) {
        if (!this.containers.hasOwnProperty(i)) {
          this.containers[i] = new container(this, i);
        }
        this.containers[i].configure(this.config[i]);
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
  function(app, name) {
    this.name = name;
    this.instances = {};
    this.modules = [];
    this.config = {};
  }, {
    /**
     * Configures each module
     */
    configure: function(options) {
      _(true, this.config, options);
      // send configuration notification to each service
      for(var i in this.config) {
        if (this.instances.hasOwnProperty(i)) {
          this.instances[i].configure(this.config[i]);
        }
      }
    },
    /**
     * Gets the container type name
     * @return String
     */
    type: function() {
      return this.name;
    }
    /**
     * Registers a structure
     */
    ,register: function(name, instance) {
      if (this.contains(name)) {
        this.instances[name].extends(instance);
      } else {
        this.modules.push(name);
        this.instances[name] = new plugin(this, name, instance);
        if (this.config.hasOwnProperty(name)) {
          this.instances[name].configure(this.config[name]);
        }
      }
      return this.instances[name];
    }
    /**
     * Gets a plugin from its name
     */
    ,get: function(service) {
      if (!this.contains(service)) {
        throw new Error('Undefined service : ' + this.name + '.' + service);
      }
      return this.instances[service];
    }
    // checks if the specified service is already defined
    ,contains: function(service) {
      return this.instances.hasOwnProperty(service);
    }
    // iterator
    ,each: function(cb) {
      for(var i in this.modules) {
        cb(this.instances[this.modules[i]]);
      }
      return this;
    }
    /**
     * triggers an event over each registered plugin
     */
    ,trigger: function(event, options) {
      return this.each(function(plugin) {
        plugin.trigger(event, options);
      });
    }
  }
);

// the module definition 
var plugin = declare(
  function(container, name, definition) {
    this.name = name;
    this.config = {};
    this.events = {};
    this.extends(definition);
  }, {
    // adds some configuration
    configure: function(options) {
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
    // extends current module
    ,extends: function(structure) {
      // define a list of protected functions
      var protected = [
        'trigger', 'configure', 'events', 'name', 'extends'
      ];
      for(var m in structure) {
        if (m === 'on') {
          // registers events
          for(var e in structure[m]) {
            this.on(e, structure[m][e]);
          }
        } else if(m == 'config') {
          // defines a default configuration
          this.configure(structure[m]);
        } else {
          if (protected.indexOf(m) > -1) {
            throw new Error(
              'Can not define "' + m + '" method on "' + this.name + '" service !'
            );
          } else {
            // registers a function
            this[m] = structure[m];
          }
        }
      }
    }
  }
);

// expose api : creates a new application instance
module.exports = function(package, config) {
  return new app(package, config);
};