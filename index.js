const Path = require('path');
const fs = require('fs-extra');
const os = require('os');
const Q = require('q');
const StreamZip = require('node-stream-zip');
const url = require('url');
const core = require('@actions/core');
const { execSync } = require('child_process');
const createComment = require('./comment');
const isWsl = require('is-wsl');
const glob = require('glob');
const crypto = require('crypto');

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
    ignoreWarnings:
      (core.getInput('ignore-warnings') || 'false').toUpperCase() === 'TRUE',
    includePath: core.getInput('include'),
    logFilePath: core.getInput('log-file'),
    metaTraderCleanUp:
      (core.getInput('mt-cleanup') || 'false').toUpperCase() === 'TRUE',
    metaTraderVersion: core.getInput('mt-version'),
    verbose: (core.getInput('verbose') || 'false').toUpperCase() === 'TRUE',
    initPlatform:
      (core.getInput('init-platform') || 'false').toUpperCase() === 'TRUE'
  };
} else {
  input = {
    checkSyntaxOnly: false,
    compilePath: './**/*.mq?',
    ignoreWarnings: false,
    includePath: '',
    logFilePath: 'my-custom-log.log',
    metaTraderCleanUp: true,
    // E.g. 4.0.0.1382, 5.0.0.2361
    metaTraderVersion: '4.0.0.1382',
    verbose: true,
    initPlatform: false
  };
}

function download(uri, filename) {
  if (fs.existsSync(filename)) {
    input.verbose &&
      console.log(`Skipping downloading of "${uri}" as "${filename}" already exists.`);
    return new Promise(resolve => {
      resolve();
    });
  }

  const protocol = url.parse(uri).protocol.slice(0, -1);
  const deferred = Q.defer();
  const onError = function (e) {
    fs.unlink(filename);
    deferred.reject(e);
  };

  require(protocol).
    get(uri, function (response) {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        const fileStream = fs.createWriteStream(filename);
        fileStream.on('error', onError);
        fileStream.on('close', deferred.resolve);
        response.pipe(fileStream);
      } else if (response.headers.location) {
        deferred.resolve(download(response.headers.location, filename));
      } else {
        deferred.reject(new Error(response.statusCode + ' ' + response.statusMessage));
      }
    }).
    on('error', onError);

  return deferred.promise;
}

const metaTraderMajorVersion = input.metaTraderVersion[0];
const metaTraderDownloadUrl = `https://github.com/EA31337/MT-Platforms/releases/download/${input.metaTraderVersion}/mt-${input.metaTraderVersion}.zip`;
const randomUuid = crypto.randomBytes(16).toString('hex');
const metaEditorZipPath = `metaeditor${metaTraderMajorVersion}_${randomUuid}.zip`;

try {
  fs.unlinkSync(input.logFilePath);
} catch (e) {
  // Silence the error.
}

try {
  input.verbose &&
    console.log(`Downloading "${metaTraderDownloadUrl}" into "${metaEditorZipPath}"...`);
  download(metaTraderDownloadUrl, metaEditorZipPath).
    then(async () => {
      if (!fs.existsSync(metaEditorZipPath))
        throw new Error('There was a problem downloading ${metaEditorZipPath} file!');

      input.verbose && console.log(`Unzipping "${metaEditorZipPath}"...`);

      /* eslint-disable */
      const zip = new StreamZip.async({
        file: metaEditorZipPath
      });
      /* eslint-enable */

      const zipTargetPath = `.platform/${randomUuid}`;
      await zip.extract(null, zipTargetPath);
      await zip.close();

      const metaTraderTargetFolderName = glob.sync(`${zipTargetPath}/*${metaTraderMajorVersion}*`)[0];
      const platformPathAbs = Path.resolve(metaTraderTargetFolderName);

      // Write variable to environment file.
      fs.writeFileSync('.env', `platform_folder=${platformPathAbs}`);
      console.log(`Platform path: "${platformPathAbs}".`);

      if (input.initPlatform) {
        const configFilePath = `tester.ini`;
        fs.writeFileSync(
          configFilePath,
          '[Tester]\r\nShutdownTerminal=true\r\nTestExpert=Dummy\r\nTestShutdownTerminal=true\r\n'
        );

        const exeFile =
          metaTraderMajorVersion === '5'
            ? `${metaTraderTargetFolderName}/terminal64.exe`
            : `${metaTraderTargetFolderName}/terminal.exe`;
        const command =
          metaTraderMajorVersion === '5'
            ? `"${exeFile}" /log:CON /portable /config:${configFilePath}`
            : `"${exeFile}" /log:CON /portable ${configFilePath}`;

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

      const includePath =
        input.includePath === ''
          ? `${metaTraderTargetFolderName}/MQL${metaTraderMajorVersion}`
          : input.includePath;
      const checkSyntaxParam = input.checkSyntaxOnly ? '/s' : '';
      const exeFile =
        metaTraderMajorVersion === '5'
          ? `${metaTraderTargetFolderName}/metaeditor64.exe`
          : `${metaTraderTargetFolderName}/metaeditor.exe`;

      let files = [];

      if (input.compilePath.includes('*'))
        files = glob(input.compilePath, { sync: true });
      else files = [input.compilePath];

      input.verbose && console.log(`Files to compile: ${files}`);

      if (!fs.existsSync(includePath))
        throw new Error(`Directory at include path "${includePath}" not found!`);

      // Compiling each file separately and checking log's output every time, as it always fresh.
      for (const path of files) {
        const command = `"${exeFile}" /portable /inc:"${includePath}" /compile:"${path}" /log:"${input.logFilePath}" ${checkSyntaxParam}`;

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

        if (input.verbose && log.includes(`${metaTraderTargetFolderName}\\MQL`))
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

          if (warnings.length > 0) {
            if (input.ignoreWarnings)
              errorText += '\n\n(Ignored) warnings found:\n';
            else errorText += '\n\nWarnings found:\n';

            for (const message of warnings) {
              errorText += `\n* ${message[0]}`;
            }
          }

          /* eslint-disable */
          await createComment(warnings, errors);
          /* eslint-enable */
          core.setFailed(errorText);
          return;
        }
      }

      if (input.metaTraderCleanUp) {
        input.verbose && console.log('Cleaning up...');
        fs.rm(metaEditorZipPath, { recursive: true });
        fs.rm(metaTraderTargetFolderName, { recursive: true });
        fs.rm('.platform', { recursive: true });
      }

      input.verbose && console.log('Done.');
    }).
    catch(error => {
      core.setFailed(error.message);
    });
} catch (error) {
  core.setFailed(error.message);
}
