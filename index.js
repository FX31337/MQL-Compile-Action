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

const isPost = Boolean(core.getState('isPost'));
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
    platformPath: '.',
    initPlatform: false,
    verbose: true,
    workingDirectory: '.'
  };
}

if (!isPost) {
  try {
    fs.unlinkSync(input.logFilePath);
  } catch (e) {
    // Silence the error.
  }

  try {
    process.chdir(input.workingDirectory);

    const configFilePath = `tester.ini`;
    const mte64Exe =
      glob.sync(Path.join(input.platformPath, '**', 'metaeditor64.exe'), {
        nocase: true
      })[0] || '';
    const mte32Exe =
      glob.sync(Path.join(input.platformPath, '**', 'metaeditor.exe'), {
        nocase: true
      })[0] || '';
    const mteExe = mte64Exe || mte32Exe || '';
    const platformPath = Path.dirname(mteExe) || '';
    // Const platformPathAbs = Path.resolve(glob.sync(platformPath)[0]);

    if (mteExe.length > 0) {
      input.verbose && console.log(`MTE path: "${mteExe}".`);
    } else {
      throw new Error(`Platform cannot be found in "${input.platformPath}"!`);
    }

    const includePath =
      input.includePath === ''
        ? Path.join(platformPath, mte64Exe.length > 0 ? 'MQL5' : 'MQL4')
        : input.includePath;

    if (input.initPlatform) {
      const command = `"${mteExe}" /log:CON /portable ${
        mte64Exe.length > 0
          ? `"/config:${configFilePath}"`
          : `"${configFilePath}"`
      }`;

      fs.writeFileSync(
        configFilePath,
        '[Tester]\r\nExpert=Dummy\n\nTestExpert=Dummy\r\nShutdownTerminal=1\r\nTestShutdownTerminal=1\r\n'
      );

      input.verbose && console.log(`Executing: ${command}`);

      try {
        const cmdOptions = { stdio: 'inherit',
timeout: 20000 };
        execSync(
          os.platform() === 'win32' || isWsl ? command : `wine ${command}`,
          cmdOptions
        );
        input.verbose && console.log('Initialization completed.');
      } catch (e) {
        // Silencing any error.
        if (e.error) {
          console.error(`Error: ${e.error}`);
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
      const command = `"${mteExe}" /portable ${cmdArgInc} /compile:"${path}" /log:"${input.logFilePath}" ${checkSyntaxParam}`;

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

        /* eslint max-depth: [2, 6] */
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

    core.saveState('isPost', 'true');
    input.verbose && console.log('Done.');
  } catch (error) {
    core.setFailed(error.message);
  }
}
