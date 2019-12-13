'use strict';

const path = require('path');
const fs = require('fs');
const Linter = require('../lib/index');
const buildFakeConsole = require('./helpers/console');
const { createTempDir } = require('broccoli-test-helper');

const fixturePath = path.join(__dirname, 'fixtures');
const initialCWD = process.cwd();

describe('public api', function() {
  let project = null;

  let mockConsole;
  beforeEach(async function() {
    mockConsole = buildFakeConsole();
    project = await createTempDir();
    process.chdir(project.path());
  });

  afterEach(async function() {
    process.chdir(initialCWD);
    await project.dispose();
  });

  describe('Linter.prototype.loadConfig', function() {
    it('throws an error if the config file has an error on parsing', function() {
      project.write({
        '.template-lintrc.js': "throw Error('error happening during config loading');\n",
      });
      expect(() => {
        new Linter({
          console: mockConsole,
        });
      }).toThrow(/error happening during config loading/);
    });

    it('uses an empty set of rules if no .template-lintrc is present', function() {
      let linter = new Linter({
        console: mockConsole,
      });

      expect(linter.config.rules).toEqual({});
    });

    it('uses provided config', function() {
      let expected = {
        rules: {
          foo: 'bar',
          baz: 'derp',
        },
      };
      project.write({
        '.template-lintrc.js': `module.exports = ${JSON.stringify(expected)};`,
        app: {
          templates: {
            'application.hbs': '',
          },
        },
      });

      let linter = new Linter({
        console: mockConsole,
        config: expected,
      });

      expect(linter.config.rules).toEqual(expected.rules);
    });

    it('uses .template-lintrc.js in cwd if present', function() {
      let expected = {
        rules: {
          foo: 'bar',
          baz: 'derp',
        },
      };
      project.write({
        '.template-lintrc.js': `module.exports = ${JSON.stringify(expected)};`,
        app: {
          templates: {
            'application.hbs': '',
          },
        },
      });

      let linter = new Linter({
        console: mockConsole,
      });

      expect(linter.config.rules).toEqual(expected.rules);
    });

    it('uses .template-lintrc in provided configPath', function() {
      let configPath = path.join(project.path(), '.template-lintrc.js');
      let expected = {
        rules: {
          foo: 'bar',
          baz: 'derp',
        },
      };
      project.write({
        '.template-lintrc.js': `module.exports = ${JSON.stringify(expected)};`,
        app: {
          templates: {
            'application.hbs': '',
          },
        },
      });

      let linter = new Linter({
        console: mockConsole,
        configPath,
      });

      expect(linter.config.rules).toEqual(expected.rules);
    });

    it('breaks if the specified configPath does not exist', function() {
      expect(() => {
        new Linter({
          console: mockConsole,
          configPath: 'does/not/exist',
        });
      }).toThrow('The configuration file specified (does/not/exist) could not be found. Aborting.');
    });

    it('with deprecated rule config', function() {
      let expected = {
        rules: {
          'bare-strings': true,
        },
      };
      project.write({
        '.template-lintrc.js': `module.exports = ${JSON.stringify(expected)};`,
      });

      let linter = new Linter({
        console: mockConsole,
        config: expected,
      });

      expect(linter.config.rules).toEqual({ 'no-bare-strings': true });
    });
  });

  describe('Linter.prototype.constructor', function() {
    it('should be able to instantiate without options', function() {
      expect(new Linter()).toBeTruthy();
    });

    it('accepts a fake console implementation', function() {
      let expected = 'foo bar widget';
      let actual;

      let linter = new Linter({
        console: {
          log(message) {
            actual = message;
          },
        },
      });

      linter.console.log(expected);
      expect(actual).toEqual(expected);
    });
  });

  describe('Linter.prototype.verify', function() {
    let basePath = null;
    let linter;
    let expected = {
      rules: {
        'bare-strings': true,
      },
    };

    beforeAll(async function() {
      project = await createTempDir();
      basePath = project.path();
      project.write({
        '.template-lintrc.js': `module.exports = ${JSON.stringify(expected)};`,
        app: {
          templates: {
            'application.hbs': '<h2>Here too!!</h2>\n<div>Bare strings are bad...</div>\n',
          },
        },
      });
    });

    this.afterAll(async function() {
      await project.dispose();
    });

    beforeEach(function() {
      linter = new Linter({
        console: mockConsole,
        configPath: path.join(basePath, '.template-lintrc.js'),
      });
    });

    it('returns an array of issues with the provided template', function() {
      let templatePath = path.join(basePath, 'app', 'templates', 'application.hbs');
      let templateContents = fs.readFileSync(templatePath, { encoding: 'utf8' });
      let expected = [
        {
          message: 'Non-translated string used',
          moduleId: templatePath,
          line: 1,
          column: 4,
          source: 'Here too!!',
          rule: 'no-bare-strings',
          severity: 2,
        },
        {
          message: 'Non-translated string used',
          moduleId: templatePath,
          line: 2,
          column: 5,
          source: 'Bare strings are bad...',
          rule: 'no-bare-strings',
          severity: 2,
        },
      ];

      let result = linter.verify({
        source: templateContents,
        moduleId: templatePath,
      });

      expect(result).toEqual(expected);
    });

    it('returns a "fatal" result object if an error occurs during parsing', function() {
      let template = '<div>';
      let result = linter.verify({
        source: template,
      });

      expect(result[0].fatal).toBe(true);
    });

    it('defaults all messages to warning severity level when module listed in pending', function() {
      linter = new Linter({
        console: mockConsole,
        config: {
          rules: { 'no-bare-strings': true },
          pending: ['some/path/here'],
        },
      });

      let template = '<div>bare string</div>';
      let result = linter.verify({
        source: template,
        moduleId: 'some/path/here',
      });

      let expected = {
        message: 'Non-translated string used',
        moduleId: 'some/path/here',
        line: 1,
        column: 5,
        source: 'bare string',
        rule: 'no-bare-strings',
        severity: 1,
      };

      expect(result).toEqual([expected]);
    });

    it('does not exclude errors when other rules are marked as pending', function() {
      linter = new Linter({
        console: mockConsole,
        config: {
          rules: { 'no-bare-strings': true, 'block-indentation': true },
          pending: [{ moduleId: 'some/path/here', only: ['block-indentation'] }],
        },
      });

      let template = '<div>bare string</div>';
      let result = linter.verify({
        source: template,
        moduleId: 'some/path/here',
      });

      let expected = {
        message: 'Non-translated string used',
        moduleId: 'some/path/here',
        line: 1,
        column: 5,
        source: 'bare string',
        rule: 'no-bare-strings',
        severity: 2,
      };

      expect(result).toEqual([expected]);
    });

    it('triggers warnings when specific rule is marked as pending', function() {
      linter = new Linter({
        console: mockConsole,
        config: {
          rules: { 'no-bare-strings': true, 'block-indentation': true },
          pending: [{ moduleId: 'some/path/here', only: ['block-indentation'] }],
        },
      });

      let template = ['<div>', '<p></p>', '</div>'].join('\n');

      let result = linter.verify({
        source: template,
        moduleId: 'some/path/here',
      });

      let expected = {
        message:
          'Incorrect indentation for `<p>` beginning at L2:C0. Expected `<p>` to be at an indentation of 2 but was found at 0.',
        moduleId: 'some/path/here',
        line: 2,
        column: 0,
        source: '<div>\n<p></p>\n</div>',
        rule: 'block-indentation',
        severity: 1,
      };

      expect(result).toEqual([expected]);
    });

    it('module listed via moduleId in pending passes an error results', function() {
      linter = new Linter({
        console: mockConsole,
        config: {
          rules: { 'no-bare-strings': true },
          pending: ['some/path/here'],
        },
      });

      let template = '<div></div>';
      let result = linter.verify({
        source: template,
        moduleId: 'some/path/here',
      });

      let expected = {
        message:
          'Pending module (`some/path/here`) passes all rules. Please remove `some/path/here` from pending list.',
        moduleId: 'some/path/here',
        severity: 2,
      };

      expect(result).toEqual([expected]);
    });

    it('module listed as object via rule exclusion in pending passes an error results', function() {
      linter = new Linter({
        console: mockConsole,
        config: {
          rules: { 'no-bare-strings': true },
          pending: [{ moduleId: 'some/path/here', only: ['no-bare-strings'] }],
        },
      });

      let template = '<div></div>';
      let result = linter.verify({
        source: template,
        moduleId: 'some/path/here',
      });

      let expected = {
        message:
          'Pending module (`some/path/here`) passes all rules. Please remove `some/path/here` from pending list.',
        moduleId: 'some/path/here',
        severity: 2,
      };

      expect(result).toEqual([expected]);
    });

    it('does not include errors when marked as ignored', function() {
      linter = new Linter({
        console: mockConsole,
        config: {
          rules: { 'no-bare-strings': true, 'block-indentation': true },
          ignore: ['some/path/here'],
        },
      });

      let template = '<div>bare string</div>';
      let result = linter.verify({
        source: template,
        moduleId: 'some/path/here',
      });

      expect(result).toEqual([]);
    });

    it('does not include errors when marked as ignored using glob', function() {
      linter = new Linter({
        console: mockConsole,
        config: {
          rules: { 'no-bare-strings': true, 'block-indentation': true },
          ignore: ['some/path/*'],
        },
      });

      let template = '<div>bare string</div>';
      let result = linter.verify({
        source: template,
        moduleId: 'some/path/here',
      });

      expect(result).toEqual([]);
    });

    it('shows a "rule not found" error if a rule defintion is not found"', function() {
      linter = new Linter({
        console: mockConsole,
        config: {
          rules: { 'missing-rule': true },
        },
      });

      let template = '';
      let result = linter.verify({
        source: template,
        moduleId: 'some/path/here',
      });

      expect(result).toEqual([
        {
          message: "Definition for rule 'missing-rule' was not found",
          moduleId: 'some/path/here',
          severity: 2,
        },
      ]);
    });
  });

  describe('Linter using plugins', function() {
    let basePath = path.join(fixturePath, 'with-plugins');
    let linter;

    beforeEach(function() {
      linter = new Linter({
        console: mockConsole,
        configPath: path.join(basePath, '.template-lintrc.js'),
      });
    });

    it('returns plugin rule issues', function() {
      let templatePath = path.join(basePath, 'app', 'templates', 'application.hbs');
      let templateContents = fs.readFileSync(templatePath, { encoding: 'utf8' });
      let expected = [
        {
          message: 'The inline form of component is not allowed',
          moduleId: templatePath,
          line: 1,
          column: 4,
          source: '{{component value="Hej"}}',
          rule: 'inline-component',
          severity: 2,
        },
      ];

      let result = linter.verify({
        source: templateContents,
        moduleId: templatePath,
      });

      expect(result).toEqual(expected);
    });

    it('allow you to disable plugin rules inline', function() {
      let templatePath = path.join(basePath, 'app', 'templates', 'disabled-rule.hbs');
      let templateContents = fs.readFileSync(templatePath, { encoding: 'utf8' });
      let expected = [];

      let result = linter.verify({
        source: templateContents,
        moduleId: templatePath,
      });

      expect(result).toEqual(expected);
    });
  });

  describe('Linter using plugin with extends', function() {
    let basePath = path.join(fixturePath, 'with-plugin-with-configurations');
    let linter;

    beforeEach(function() {
      linter = new Linter({
        console: mockConsole,
        configPath: path.join(basePath, '.template-lintrc.js'),
      });
    });

    it('returns plugin rule issues', function() {
      let templatePath = path.join(basePath, 'app', 'templates', 'application.hbs');
      let templateContents = fs.readFileSync(templatePath, { encoding: 'utf8' });
      let expected = [
        {
          message: 'The inline form of component is not allowed',
          moduleId: templatePath,
          line: 1,
          column: 4,
          source: '{{component value="Hej"}}',
          rule: 'inline-component',
          severity: 2,
        },
      ];

      let result = linter.verify({
        source: templateContents,
        moduleId: templatePath,
      });

      expect(result).toEqual(expected);
    });
  });
  describe('Linter using plugin with multiple extends', function() {
    let basePath = path.join(fixturePath, 'with-multiple-extends');
    let linter;

    beforeEach(function() {
      linter = new Linter({
        console: mockConsole,
        configPath: path.join(basePath, '.template-lintrc.js'),
      });
    });

    it('returns plugin rule issues', function() {
      let templatePath = path.join(basePath, 'app', 'templates', 'application.hbs');
      let templateContents = fs.readFileSync(templatePath, { encoding: 'utf8' });
      let expected = [
        {
          message: 'The inline form of component is not allowed',
          moduleId: templatePath,
          line: 1,
          column: 4,
          source: '{{component value="Hej"}}',
          rule: 'inline-component',
          severity: 2,
        },
        {
          message: 'Usage of triple curly brackets is unsafe',
          moduleId: templatePath,
          line: 2,
          column: 2,
          source: '{{{this.myVar}}}',
          rule: 'no-triple-curlies',
          severity: 2,
        },
      ];

      let result = linter.verify({
        source: templateContents,
        moduleId: templatePath,
      });

      expect(result).toEqual(expected);
    });
  });

  describe('Linter using plugins (inline plugins)', function() {
    let basePath = path.join(fixturePath, 'with-inline-plugins');
    let linter;

    beforeEach(function() {
      linter = new Linter({
        console: mockConsole,
        configPath: path.join(basePath, '.template-lintrc.js'),
      });
    });

    it('returns plugin rule issues', function() {
      let templatePath = path.join(basePath, 'app', 'templates', 'application.hbs');
      let templateContents = fs.readFileSync(templatePath, { encoding: 'utf8' });
      let expected = [
        {
          message: 'The inline form of component is not allowed',
          moduleId: templatePath,
          line: 1,
          column: 4,
          source: '{{component value="Hej"}}',
          rule: 'inline-component',
          severity: 2,
        },
      ];

      let result = linter.verify({
        source: templateContents,
        moduleId: templatePath,
      });

      expect(result).toEqual(expected);
    });
  });

  describe('Linter using plugins loading a configuration that extends from another plugins configuration', function() {
    let basePath = path.join(fixturePath, 'with-plugins-overwriting');
    let linter;

    beforeEach(function() {
      linter = new Linter({
        console: mockConsole,
        configPath: path.join(basePath, '.template-lintrc.js'),
      });
    });

    it('returns plugin rule issues', function() {
      let templatePath = path.join(basePath, 'app', 'templates', 'application.hbs');
      let templateContents = fs.readFileSync(templatePath, { encoding: 'utf8' });
      let expected = [];

      let result = linter.verify({
        source: templateContents,
        moduleId: templatePath,
      });

      expect(result).toEqual(expected);
    });
  });

  describe('Linter.prototype.statusForModule', function() {
    it('returns true when the provided moduleId is listed in `pending`', function() {
      let linter = new Linter({
        console: mockConsole,
        config: {
          pending: ['some/path/here', { moduleId: 'foo/bar/baz', only: ['no-bare-strings'] }],
        },
      });

      expect(linter.statusForModule('pending', 'some/path/here')).toBeTruthy();
      expect(linter.statusForModule('pending', 'foo/bar/baz')).toBeTruthy();
      expect(linter.statusForModule('pending', 'some/other/path')).toBeFalsy();
    });

    it('matches with absolute paths for modules', function() {
      let linter = new Linter({
        console: mockConsole,
        config: {
          pending: ['some/path/here', { moduleId: 'foo/bar/baz', only: ['no-bare-strings'] }],
        },
      });

      expect(linter.statusForModule('pending', `${process.cwd()}/some/path/here`)).toBeTruthy();
      expect(linter.statusForModule('pending', `${process.cwd()}/foo/bar/baz`)).toBeTruthy();
    });
  });
});
