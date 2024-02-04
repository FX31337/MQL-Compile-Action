const Path = require('path');
const fs = require('fs-extra');
const os = require('os');
const core = require('@actions/core');
const { execSync } = require('child_process');
const createComment = require('./comment');
const isWsl = require('is-wsl');
const glob = require('glob');

// Unhandled promise rejections will end up as GHA action failure.
// Thus way we don't need to check for all possible errors.
process.on('unhandledRejection', error => {
  core.setFailed(error ? error : 'Unknown error occurred!');
});

// Set this to false if you want to test the action locally via:
// $ ncc build && node index.js
const realRun = true;

let input;

if (realRun) {
  input = {
    checkSyntaxOnly:
      (core.getInput('syntax-only') || 'false').toUpperCase() === 'TRUE',
    compilePath: core.getInput('path'),
    compilePathIgnore: core.getInput('path-ignore'),
    ignoreWarnings:
      (core.getInput('ignore-warnings') || 'false').toUpperCase() === 'TRUE',
    includePath: core.getInput('include'),
    logFilePath: core.getInput('log-file'),
    platformPath: core.getInput('mt-path') || '.',
    verbose: (core.getInput('verbose') || 'false').toUpperCase() === 'TRUE',
    initPlatform:
      (core.getInput('init-platform') || 'false').toUpperCase() === 'TRUE',
    workingDirectory: core.getInput('working-directory') || '.'
  };
} else {
  input = {
    checkSyntaxOnly: false,
    compilePath: './**/*.mq?',
    compilePathIgnore: './**/*.mqh',
    ignoreWarnings: false,
    includePath: '',
    logFilePath: 'my-custom-log.log',
    platformPath: '.platform',
    initPlatform: false,
    verbose: true,
    workingDirectory: '.'
  };
}

try {
  fs.unlinkSync(input.logFilePath);
} catch (e) {
  // Silence the error.
}

try {
  process.chdir(input.workingDirectory);

  const configFilePath = `tester.ini`;
  const terminal64Exe = glob.sync(Path.join(input.platformPath, '**', 'terminal64.exe'))[0];
  const terminal32Exe = glob.sync(Path.join(input.platformPath, '**', 'terminal.exe'))[0];
  const terminalExe = terminal64Exe || terminal32Exe || '';
  const platformPath = Path.dirname(terminalExe);
  // Const platformPathAbs = Path.resolve(glob.sync(platformPath)[0]);

  if (terminalExe.length > 0) {
    console.log(`Terminal path: "${terminalExe}".`);
  } else {
    throw new Error(`Terminal cannot be found in "${input.platformPath}"!`);
  }

  if (terminal32Exe.length > 0) {
    fs.writeFileSync(
      configFilePath,
      '[Tester]\r\nShutdownTerminal=true\r\nTestExpert=Dummy\r\nTestShutdownTerminal=true\r\n'
    );
  }
  const includePath =
    input.includePath === ''
      ? Path.join(platformPath, terminal64Exe.length > 0 ? 'MQL5' : 'MQL4')
      : input.includePath;

  if (input.initPlatform) {
    const command = `"${terminalExe}" /log:CON /portable ${
      terminal64Exe.length > 0
        ? `"/config:${configFilePath}"`
        : `"${configFilePath}"`
    }`;

    input.verbose && console.log(`Executing: ${command}`);

    try {
      const cmdOptions = { stdio: 'inherit',
timeout: 20000 };
      execSync(
        os.platform() === 'win32' || isWsl ? command : `wine ${command}`,
        cmdOptions
      );
      console.log('Initialization completed.');
    } catch (e) {
      // Silencing any error.
      if (e.error) {
        console.log(`Error: ${e.error}`);
      }
    }
  }

  const checkSyntaxParam = input.checkSyntaxOnly ? '/s' : '';

  let files = [];

  if (input.compilePath.includes('*'))
    files = glob(input.compilePath, {
      ignore: input.compilePathIgnore,
      sync: true
    });
  else files = [input.compilePath];

  input.verbose && console.log(`Files to compile: ${files}`);

  if (input.includePath !== '' && !fs.existsSync(includePath))
    throw new Error(`Directory at include path "${includePath}" not found!`);

  // Compiling each file separately and checking log's output every time, as it always fresh.
  for (const path of files) {
    const cmdArgInc = input.includePath === '' ? '' : `/inc:"${includePath}"`;
    const command = `"${terminalExe}" /portable ${cmdArgInc} /compile:"${path}" /log:"${input.logFilePath}" ${checkSyntaxParam}`;

    input.verbose && console.log(`Executing: ${command}`);

    try {
      execSync(os.platform() === 'win32' || isWsl ? command : `wine ${command}`);
    } catch (e) {
      if (e.error) {
        console.log(`Error: ${e.error}`);
      }
    }

    let log;

    try {
      log = fs.readFileSync(input.logFilePath, 'utf-16le').toString('utf8');
    } catch (e) {
      console.log(`Missing log file "${input.logFilePath}".`);
      log = 'No log file found.\n';
    }

    input.verbose && console.log('Log output:');
    input.verbose && console.log(log);

    if (input.verbose && log.includes(`${platformPath}\\MQL`))
      console.log(`Please check if you enabled "init-platform" for a MQL-Compile-Action as it looks like your code makes use of built-in MT's libraries!\n`);

    const errorCheckingRuleWarning = /(.*warning [0-9]+:.*)/gu;
    const errorCheckingRuleError = /(.*error [0-9]+:.*)/gu;

    const wereErrorsFound = errorCheckingRuleError.test(log);
    const wereWarningsFound =
      !input.ignoreWarnings && errorCheckingRuleWarning.test(log);

    if (wereErrorsFound || wereWarningsFound) {
      input.verbose &&
        console.log('Warnings/errors occurred. Returning exit code 1.');

      // Composing error string.
      let errorText = 'Compilation failed!';

      const errors = [...log.matchAll(errorCheckingRuleError)];

      if (errors.length > 0) {
        errorText += '\n\nErrors found:\n';
        for (const message of errors) {
          errorText += `\n* ${message[0]}`;
        }
      }

      const warnings = [...log.matchAll(errorCheckingRuleWarning)];

      /* eslint max-depth: [2, 5] */
      if (warnings.length > 0) {
        if (input.ignoreWarnings)
          errorText += '\n\n(Ignored) warnings found:\n';
        else errorText += '\n\nWarnings found:\n';

        for (const message of warnings) {
          errorText += `\n* ${message[0]}`;
        }
      }

      /* eslint-disable */
      createComment(warnings, errors);
      /* eslint-enable */
      core.setFailed(errorText);
    }
  }

  input.verbose && console.log('Done.');
} catch (error) {
  core.setFailed(error.message);
}
