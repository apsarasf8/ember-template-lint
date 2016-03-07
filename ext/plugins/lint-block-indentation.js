'use strict';

// Forces block syntax to have appropriate indentation
//
// passes:
// {{#each foo as |bar|}}
// {{/each}}
//
// breaks:
// {{#each foo as |bar|}}
//  {{/each}}

var calculateLocationDisplay = require('../helpers/calculate-location-display');
var buildPlugin = require('./base');

module.exports = function(addonContext) {
  var BlockIndentation = buildPlugin(addonContext, 'block-indentation');

  BlockIndentation.prototype.detect = function(node) {
    return node.type === 'BlockStatement' || node.type === 'ElementNode';
  };

  BlockIndentation.prototype.process = function(node) {
    this['process' + node.type](node);
  };

  BlockIndentation.prototype.buildWarning = function(name, locationInfo) {
    return 'Incorrect `' + name + '` block indention at beginning at ' + locationInfo;
  };

  BlockIndentation.prototype.processElementNode = function(node) {
    // HTML elements that start and end on the same line are fine
    if (node.loc.start.line === node.loc.end.line) {
      return;
    }

    var startColumn = node.loc.start.column;
    var endColumn   = node.loc.end.column;

    var correctedEndColumn = endColumn - node.tag.length - 3;
    if(correctedEndColumn !== startColumn) {
      var startLocation = calculateLocationDisplay(this.options.moduleName, node.loc && node.loc.start);
      var endLocation = calculateLocationDisplay(this.options.moduleName, node.loc && node.loc.end);

      var warning = 'Incorrect indentation for `' + node.tag + '` beginning at ' + startLocation +
            '. Expected `</' + node.tag + '>` ending at ' + endLocation + 'to be at an indentation of ' + startColumn + ' but ' +
            'was found at ' + correctedEndColumn + '.';
      this.log(warning);
    }
  };

  BlockIndentation.prototype.processBlockStatement = function(node) {
    var startColumn = node.loc.start.column;
    var endColumn   = node.loc.end.column;

    var correctedEndColumn = endColumn - node.path.original.length - 5;
    if(correctedEndColumn !== startColumn) {
      var startLocation = calculateLocationDisplay(this.options.moduleName, node.loc && node.loc.start);
      var endLocation = calculateLocationDisplay(this.options.moduleName, node.loc && node.loc.end);

      var warning = 'Incorrect indentation for `' + node.path.original + '` beginning at ' + startLocation +
            '. Expected `{{/' + node.path.original + '}}` ending at ' + endLocation + 'to be at an indentation of ' + startColumn + ' but ' +
            'was found at ' + correctedEndColumn + '.';

      this.log(warning);
    }
  };

  return BlockIndentation;
};
