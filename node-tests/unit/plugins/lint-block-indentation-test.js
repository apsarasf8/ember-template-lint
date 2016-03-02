'use strict';

var assert = require('assert');
var buildTemplateCompiler = require('../../helpers/template-compiler');
var plugins = require('../../../ext/plugins');

describe('Block indentation plugin', function() {
  var DISABLE_ALL = '<!-- template-lint disable=true -->';
  var DISABLE_ONE = '<!-- template-lint block-indentation=false -->';
  var BAD = '\n  {{#each cats as |dog|}}  {{/each}}';
  var GOOD = '\n  {{#each cats as |dog|}}\n  {{/each}}';
  var addonContext;
  var templateCompiler;
  var messages;
  var config;

  beforeEach(function() {
    messages = [];
    config   = {};

    addonContext = {
      logLintingError: function(pluginName, moduleName, message) {
        messages.push(message);
      },
      loadConfig: function() {
        return config;
      }
    };


    templateCompiler = buildTemplateCompiler();
  });

  it('logs a message in the console when given incorrect indentation', function() {
    templateCompiler.registerPlugin('ast', plugins['block-indentation'](addonContext));
    templateCompiler.precompile(BAD, {
      moduleName: 'layout.hbs'
    });

    assert.deepEqual(messages, ["Incorrect `each` block indention at beginning at ('layout.hbs'@ L2:C2)"]);
  });

  it('passes when given correct indentation', function() {
    templateCompiler.registerPlugin('ast', plugins['block-indentation'](addonContext));
    templateCompiler.precompile(GOOD, {
      moduleName: 'layout.hbs'
    });

    assert.deepEqual(messages, []);
  });

  it('rule can be disabled via config', function() {
    config['block-indentation'] = false;
    templateCompiler.registerPlugin('ast', plugins['block-indentation'](addonContext));
    templateCompiler.precompile(BAD, {
      moduleName: 'layout.hbs'
    });

    assert.deepEqual(messages, []);
  });

  it('rule can be disabled via inline comment - single rule', function() {
    templateCompiler.registerPlugin('ast', plugins['block-indentation'](addonContext));
    templateCompiler.precompile(DISABLE_ONE + '\n' + BAD, {
      moduleName: 'layout.hbs'
    });

    assert.deepEqual(messages, []);
  });

  it('rule can be disabled via inline comment - all rules', function() {
    templateCompiler.registerPlugin('ast', plugins['block-indentation'](addonContext));
    templateCompiler.precompile(DISABLE_ALL + '\n' + BAD, {
      moduleName: 'layout.hbs'
    });

    assert.deepEqual(messages, []);
  });
});
