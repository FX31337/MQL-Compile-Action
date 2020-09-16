const fs = require('fs');
const os = require('os');
const Q = require('q');
const StreamZip = require('node-stream-zip');
const url = require('url');
const core = require('@actions/core');
const { exec } = require('child_process');
const createComment = require('./comment');

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
    verbose: (core.getInput('verbose') || 'false').toUpperCase() === 'TRUE'
  };
} else {
  input = {
    checkSyntaxOnly: false,
    compilePath: '.',
    ignoreWarnings: false,
    includePath: '.',
    logFilePath: 'my-custom-log.log',
    metaTraderCleanUp: true,
    metaTraderVersion: '5.0.0.2361',
    verbose: true
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
const metaEditorZipPath = `metaeditor${metaTraderMajorVersion}.zip`;

try {
  input.verbose &&
    console.log(`Downloading "${metaTraderDownloadUrl}" into "${metaEditorZipPath}"...`);
  download(metaTraderDownloadUrl, metaEditorZipPath).
    then(() => {
      if (!fs.existsSync(metaEditorZipPath))
        throw new Error('There was a problem downloading ${metaEditorZipPath} file!');

      input.verbose && console.log(`Unzipping "${metaEditorZipPath}"...`);

      const zip = new StreamZip({
        file: metaEditorZipPath
      });

      zip.on('ready', () => {
        zip.extract(null, '.', error => {
          if (error) throw new Error(error);

          const checkSyntaxParam = input.checkSyntaxOnly ? '/s' : '';
          const exeFile = metaTraderMajorVersion === '5' ? "MetaTrader 5/metaeditor64.exe" : "MetaTrader 4/metaeditor.exe";
          const command = `"${exeFile}" /compile:"${input.compilePath}" /inc:"${input.includePath}" /log:"${input.logFilePath}" ${checkSyntaxParam}`;

          input.verbose && console.log(`Executing: ${command}`);

          exec(os.platform() === 'win32' ? command : `wine ${command}`, async error => {
            if (error && !fs.existsSync(input.logFilePath)) {
              throw new Error(error);
            }

            const log = fs.
              readFileSync(input.logFilePath, 'utf-16le').
              toString('utf8');

            input.verbose && console.log('Log output:');
            input.verbose && console.log(log);

            const warnings = log.split('\n').filter(line => (/: warning (\d+):/u).test(line));
            const errors = log.split('\n').filter(line => (/: error (\d+):/u).test(line));
            let errorCheckingRule;
            if (input.ignoreWarnings) errorCheckingRule = /[1-9]+[0-9]* error/u;
            else errorCheckingRule = /[1-9]+[0-9]* (warning|error)/u;

            if (errorCheckingRule.test(log)) {
              input.verbose &&
                console.log('Warnings/errors occurred. Returning exit code 1.');
              await createComment(warnings, errors);
              core.setFailed('Compilation failed!');
              return;
            }

            exec(`rm "${metaEditorZipPath}"`, () => {
              if (input.metaTraderCleanUp)
                exec(`rm -R "MetaTrader ${metaTraderMajorVersion}"`);
            });
          });
        });
      });
      zip.on('error', error => {
        throw new Error(error);
      });
    }).
    catch(error => {
      core.setFailed(error.message);
    });
} catch (error) {
  core.setFailed(error.message);
}
