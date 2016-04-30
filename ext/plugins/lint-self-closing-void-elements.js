'use strict';

/*
 Disallows self-closing void elements

 ```
 {{! good }}
 <hr>

 {{! bad}}
 <hr />
 ```

 The following values are valid configuration:

   * boolean -- `true` for enabled / `false` for disabled
 */

var calculateLocationDisplay = require('../helpers/calculate-location-display');
var buildPlugin = require('./base');
/**
 * [Specs of Void Elements]{@link https://www.w3.org/TR/html-markup/syntax.html#void-element}
 * @type {Object}
 */
var VOID_TAGS = { area: true,
                  base: true,
                  br: true,
                  col: true,
                  command: true,
                  embed: true,
                  hr: true,
                  img: true,
                  input: true,
                  keygen: true,
                  link: true,
                  meta: true,
                  param: true,
                  source: true,
                  track: true,
                  wbr: true };

module.exports = function(addonContext) {
  var LogSelfClosingVoidElements = buildPlugin(addonContext, 'lint-self-closing-void-elements');

  LogSelfClosingVoidElements.prototype.detect = function(node) {
    return this.config && node.type === 'ElementNode' && VOID_TAGS[node.tag];
  };

  LogSelfClosingVoidElements.prototype.process = function(node) {
    var source = this.sourceForNode(node).trim();
    var sourceEndTwoCharacters = source.slice(source.length - 2);

    if (sourceEndTwoCharacters === '/>') {
      var warning = 'Self-closing void element as <' + node.tag +
        '> is redundant ' + calculateLocationDisplay(this.options.moduleName, node.loc.start);

      this.log(warning);
    }
  };

  return LogSelfClosingVoidElements;
};
