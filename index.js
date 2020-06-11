const fs = require('fs')
const Q = require('Q')
const StreamZip = require('node-stream-zip')
const url = require('url')
const encoding = require('encoding')
const process = require('process')
const core = require('@actions/core')
const github = require('@actions/github')
const {exec} = require('child_process')
const https = require('https')

// Set this to false if you want to test the action locally via:
// $ ncc build && node index.js
const realRun = true

const input = realRun
  ? {
      compilePath: core.getInput('path'),
      metaTraderVersion: core.getInput('mt-version'),
      metaTraderCleanUp: core.getInput('mt-cleanup'),
      ignoreWarnings: core.getInput('ignore-warnings'),
      logFilePath: core.getInput('log-file'),
      checkSyntaxOnly: core.getInput('check-syntax-only'),
      verbose: core.getInput('verbose')
    }
  : {
      compilePath: '.',
      metaTraderVersion: '5.0.0.2361',
      metaTraderCleanUp: true,
      ignoreWarnings: false,
      logFilePath: 'my-custom-log.log',
      checkSyntaxOnly: false,
      verbose: true
    }

function download(uri, filename) {
  if (fs.existsSync(filename)) {
    input.verbose &&
      console.log(
        `Skipping downloading of "${uri}" as "${filename}" already exists.`
      )
    return new Promise((resolve, reject) => {
      resolve()
    })
  }

  const protocol = url.parse(uri).protocol.slice(0, -1)
  const deferred = Q.defer()
  const onError = function (e) {
    fs.unlink(filename)
    deferred.reject(e)
  }

  require(protocol)
    .get(uri, function (response) {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        const fileStream = fs.createWriteStream(filename)
        fileStream.on('error', onError)
        fileStream.on('close', deferred.resolve)
        response.pipe(fileStream)
      } else if (response.headers.location) {
        deferred.resolve(download(response.headers.location, filename))
      } else {
        deferred.reject(
          new Error(response.statusCode + ' ' + response.statusMessage)
        )
      }
    })
    .on('error', onError)

  return deferred.promise
}

const metaTraderMajorVersion = input.metaTraderVersion[0]
const metaTraderDownloadUrl = `https://github.com/EA31337/MT-Platforms/releases/download/${input.metaTraderVersion}/mt-${input.metaTraderVersion}.zip`
const metaEditorZipPath = `metaeditor${metaTraderMajorVersion}.zip`

try {
  input.verbose &&
    console.log(
      `Downloading "${metaTraderDownloadUrl}" into "${metaEditorZipPath}"...`
    )
  download(metaTraderDownloadUrl, metaEditorZipPath)
    .then(() => {
      if (!fs.existsSync(metaEditorZipPath))
        throw new Error(
          'There was a problem downloading ${metaEditorZipPath} file!'
        )

      input.verbose && console.log(`Unzipping "${metaEditorZipPath}"...`)

      const zip = new StreamZip({
        file: metaEditorZipPath
      })

      zip.on('ready', () => {
        zip.extract(null, '.', (error, count) => {
          if (error) throw new Error(error)

          const checkSyntaxParam = input.checkSyntaxOnly ? '/s' : ''

          let command

          if (metaTraderMajorVersion === '5')
            command = `"MetaTrader 5/metaeditor64.exe" ${checkSyntaxParam} /compile:"${input.compilePath}" /log:"${input.logFilePath}"`
          else
            command = `"MetaTrader 4/metaeditor.exe" ${checkSyntaxParam} /compile:"${input.compilePath}" /log:"${input.logFilePath}"`

          input.verbose && console.log(`Executing: ${command}`)

          exec(command, (error, stdout, stderr) => {
            if (error && !fs.existsSync(input.logFilePath)) {
              throw new Error(error)
            }

            const log = fs
              .readFileSync(input.logFilePath, 'utf-16le')
              .toString('utf8')

            input.verbose && console.log('Log output:')
            input.verbose && console.log(log)

            let errorCheckingRule
            if (input.ignoreWarnings) errorCheckingRule = /[1-9]+[0-9]* error/u
            else errorCheckingRule = /[1-9]+[0-9]* (warning|error)/u

            if (errorCheckingRule.test(log)) {
              input.verbose &&
                console.log('Warnings/errors occurred. Returning exit code 1.')
              throw new Error('Compilation failed!')
            }

            exec(`rm "${metaEditorZipPath}"`, () => {
              if (input.metaTraderCleanUp)
                exec(`rm -R "MetaTrader ${metaTraderMajorVersion}"`)
            })
          })
        })
      })
      zip.on('error', error => {
        throw new Error(error)
      })
    })
    .catch(error => {
      core.setFailed(error.message)
    })
} catch (error) {
  core.setFailed(error.message)
}
