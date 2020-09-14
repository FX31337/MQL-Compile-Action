module.exports =
/******/ (function(modules, runtime) { // webpackBootstrap
/******/ 	"use strict";
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	__webpack_require__.ab = __dirname + "/";
/******/
/******/ 	// the startup function
/******/ 	function startup() {
/******/ 		// Load entry module and return exports
/******/ 		return __webpack_require__(104);
/******/ 	};
/******/
/******/ 	// run startup
/******/ 	return startup();
/******/ })
/************************************************************************/
/******/ ({

/***/ 87:
/***/ (function(module) {

module.exports = require("os");

/***/ }),

/***/ 104:
/***/ (function(__unusedmodule, __unusedexports, __webpack_require__) {

const fs = __webpack_require__(747);
const os = __webpack_require__(87);
const Q = __webpack_require__(856);
const StreamZip = __webpack_require__(976);
const url = __webpack_require__(835);
const core = __webpack_require__(470);
const { exec } = __webpack_require__(129);

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

          exec(os.platform === 'win32' ? command : `wine ${command}`, error => {
            if (error && !fs.existsSync(input.logFilePath)) {
              throw new Error(error);
            }

            const log = fs.
              readFileSync(input.logFilePath, 'utf-16le').
              toString('utf8');

            input.verbose && console.log('Log output:');
            input.verbose && console.log(log);

            let errorCheckingRule;
            if (input.ignoreWarnings) errorCheckingRule = /[1-9]+[0-9]* error/u;
            else errorCheckingRule = /[1-9]+[0-9]* (warning|error)/u;

            if (errorCheckingRule.test(log)) {
              input.verbose &&
                console.log('Warnings/errors occurred. Returning exit code 1.');
              throw new Error('Compilation failed!');
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


/***/ }),

/***/ 129:
/***/ (function(module) {

module.exports = require("child_process");

/***/ }),

/***/ 413:
/***/ (function(module) {

module.exports = require("stream");

/***/ }),

/***/ 431:
/***/ (function(__unusedmodule, exports, __webpack_require__) {

"use strict";

var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const os = __importStar(__webpack_require__(87));
/**
 * Commands
 *
 * Command Format:
 *   ::name key=value,key=value::message
 *
 * Examples:
 *   ::warning::This is the message
 *   ::set-env name=MY_VAR::some value
 */
function issueCommand(command, properties, message) {
    const cmd = new Command(command, properties, message);
    process.stdout.write(cmd.toString() + os.EOL);
}
exports.issueCommand = issueCommand;
function issue(name, message = '') {
    issueCommand(name, {}, message);
}
exports.issue = issue;
const CMD_STRING = '::';
class Command {
    constructor(command, properties, message) {
        if (!command) {
            command = 'missing.command';
        }
        this.command = command;
        this.properties = properties;
        this.message = message;
    }
    toString() {
        let cmdStr = CMD_STRING + this.command;
        if (this.properties && Object.keys(this.properties).length > 0) {
            cmdStr += ' ';
            let first = true;
            for (const key in this.properties) {
                if (this.properties.hasOwnProperty(key)) {
                    const val = this.properties[key];
                    if (val) {
                        if (first) {
                            first = false;
                        }
                        else {
                            cmdStr += ',';
                        }
                        cmdStr += `${key}=${escapeProperty(val)}`;
                    }
                }
            }
        }
        cmdStr += `${CMD_STRING}${escapeData(this.message)}`;
        return cmdStr;
    }
}
/**
 * Sanitizes an input into a string so it can be passed into issueCommand safely
 * @param input input to sanitize into a string
 */
function toCommandValue(input) {
    if (input === null || input === undefined) {
        return '';
    }
    else if (typeof input === 'string' || input instanceof String) {
        return input;
    }
    return JSON.stringify(input);
}
exports.toCommandValue = toCommandValue;
function escapeData(s) {
    return toCommandValue(s)
        .replace(/%/g, '%25')
        .replace(/\r/g, '%0D')
        .replace(/\n/g, '%0A');
}
function escapeProperty(s) {
    return toCommandValue(s)
        .replace(/%/g, '%25')
        .replace(/\r/g, '%0D')
        .replace(/\n/g, '%0A')
        .replace(/:/g, '%3A')
        .replace(/,/g, '%2C');
}
//# sourceMappingURL=command.js.map

/***/ }),

/***/ 470:
/***/ (function(__unusedmodule, exports, __webpack_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const command_1 = __webpack_require__(431);
const os = __importStar(__webpack_require__(87));
const path = __importStar(__webpack_require__(622));
/**
 * The code to exit an action
 */
var ExitCode;
(function (ExitCode) {
    /**
     * A code indicating that the action was successful
     */
    ExitCode[ExitCode["Success"] = 0] = "Success";
    /**
     * A code indicating that the action was a failure
     */
    ExitCode[ExitCode["Failure"] = 1] = "Failure";
})(ExitCode = exports.ExitCode || (exports.ExitCode = {}));
//-----------------------------------------------------------------------
// Variables
//-----------------------------------------------------------------------
/**
 * Sets env variable for this action and future actions in the job
 * @param name the name of the variable to set
 * @param val the value of the variable. Non-string values will be converted to a string via JSON.stringify
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function exportVariable(name, val) {
    const convertedVal = command_1.toCommandValue(val);
    process.env[name] = convertedVal;
    command_1.issueCommand('set-env', { name }, convertedVal);
}
exports.exportVariable = exportVariable;
/**
 * Registers a secret which will get masked from logs
 * @param secret value of the secret
 */
function setSecret(secret) {
    command_1.issueCommand('add-mask', {}, secret);
}
exports.setSecret = setSecret;
/**
 * Prepends inputPath to the PATH (for this action and future actions)
 * @param inputPath
 */
function addPath(inputPath) {
    command_1.issueCommand('add-path', {}, inputPath);
    process.env['PATH'] = `${inputPath}${path.delimiter}${process.env['PATH']}`;
}
exports.addPath = addPath;
/**
 * Gets the value of an input.  The value is also trimmed.
 *
 * @param     name     name of the input to get
 * @param     options  optional. See InputOptions.
 * @returns   string
 */
function getInput(name, options) {
    const val = process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] || '';
    if (options && options.required && !val) {
        throw new Error(`Input required and not supplied: ${name}`);
    }
    return val.trim();
}
exports.getInput = getInput;
/**
 * Sets the value of an output.
 *
 * @param     name     name of the output to set
 * @param     value    value to store. Non-string values will be converted to a string via JSON.stringify
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setOutput(name, value) {
    command_1.issueCommand('set-output', { name }, value);
}
exports.setOutput = setOutput;
/**
 * Enables or disables the echoing of commands into stdout for the rest of the step.
 * Echoing is disabled by default if ACTIONS_STEP_DEBUG is not set.
 *
 */
function setCommandEcho(enabled) {
    command_1.issue('echo', enabled ? 'on' : 'off');
}
exports.setCommandEcho = setCommandEcho;
//-----------------------------------------------------------------------
// Results
//-----------------------------------------------------------------------
/**
 * Sets the action status to failed.
 * When the action exits it will be with an exit code of 1
 * @param message add error issue message
 */
function setFailed(message) {
    process.exitCode = ExitCode.Failure;
    error(message);
}
exports.setFailed = setFailed;
//-----------------------------------------------------------------------
// Logging Commands
//-----------------------------------------------------------------------
/**
 * Gets whether Actions Step Debug is on or not
 */
function isDebug() {
    return process.env['RUNNER_DEBUG'] === '1';
}
exports.isDebug = isDebug;
/**
 * Writes debug message to user log
 * @param message debug message
 */
function debug(message) {
    command_1.issueCommand('debug', {}, message);
}
exports.debug = debug;
/**
 * Adds an error issue
 * @param message error issue message. Errors will be converted to string via toString()
 */
function error(message) {
    command_1.issue('error', message instanceof Error ? message.toString() : message);
}
exports.error = error;
/**
 * Adds an warning issue
 * @param message warning issue message. Errors will be converted to string via toString()
 */
function warning(message) {
    command_1.issue('warning', message instanceof Error ? message.toString() : message);
}
exports.warning = warning;
/**
 * Writes info to log with console.log.
 * @param message info message
 */
function info(message) {
    process.stdout.write(message + os.EOL);
}
exports.info = info;
/**
 * Begin an output group.
 *
 * Output until the next `groupEnd` will be foldable in this group
 *
 * @param name The name of the output group
 */
function startGroup(name) {
    command_1.issue('group', name);
}
exports.startGroup = startGroup;
/**
 * End an output group.
 */
function endGroup() {
    command_1.issue('endgroup');
}
exports.endGroup = endGroup;
/**
 * Wrap an asynchronous function call in a group.
 *
 * Returns the same type as the function itself.
 *
 * @param name The name of the group
 * @param fn The function to wrap in the group
 */
function group(name, fn) {
    return __awaiter(this, void 0, void 0, function* () {
        startGroup(name);
        let result;
        try {
            result = yield fn();
        }
        finally {
            endGroup();
        }
        return result;
    });
}
exports.group = group;
//-----------------------------------------------------------------------
// Wrapper action state
//-----------------------------------------------------------------------
/**
 * Saves state for current action, the state can only be retrieved by this action's post job execution.
 *
 * @param     name     name of the state to store
 * @param     value    value to store. Non-string values will be converted to a string via JSON.stringify
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function saveState(name, value) {
    command_1.issueCommand('save-state', { name }, value);
}
exports.saveState = saveState;
/**
 * Gets the value of an state set by this action's main execution.
 *
 * @param     name     name of the state to get
 * @returns   string
 */
function getState(name) {
    return process.env[`STATE_${name}`] || '';
}
exports.getState = getState;
//# sourceMappingURL=core.js.map

/***/ }),

/***/ 614:
/***/ (function(module) {

module.exports = require("events");

/***/ }),

/***/ 622:
/***/ (function(module) {

module.exports = require("path");

/***/ }),

/***/ 669:
/***/ (function(module) {

module.exports = require("util");

/***/ }),

/***/ 747:
/***/ (function(module) {

module.exports = require("fs");

/***/ }),

/***/ 761:
/***/ (function(module) {

module.exports = require("zlib");

/***/ }),

/***/ 835:
/***/ (function(module) {

module.exports = require("url");

/***/ }),

/***/ 856:
/***/ (function() {

eval("require")("Q");


/***/ }),

/***/ 976:
/***/ (function(module, __unusedexports, __webpack_require__) {

/**
 * @license node-stream-zip | (c) 2020 Antelle | https://github.com/antelle/node-stream-zip/blob/master/LICENSE
 * Portions copyright https://github.com/cthackers/adm-zip | https://raw.githubusercontent.com/cthackers/adm-zip/master/LICENSE
 */

// region Deps

var
    util = __webpack_require__(669),
    fs = __webpack_require__(747),
    path = __webpack_require__(622),
    events = __webpack_require__(614),
    zlib = __webpack_require__(761),
    stream = __webpack_require__(413);

// endregion

// region Constants

var consts = {
    /* The local file header */
    LOCHDR           : 30, // LOC header size
    LOCSIG           : 0x04034b50, // "PK\003\004"
    LOCVER           : 4, // version needed to extract
    LOCFLG           : 6, // general purpose bit flag
    LOCHOW           : 8, // compression method
    LOCTIM           : 10, // modification time (2 bytes time, 2 bytes date)
    LOCCRC           : 14, // uncompressed file crc-32 value
    LOCSIZ           : 18, // compressed size
    LOCLEN           : 22, // uncompressed size
    LOCNAM           : 26, // filename length
    LOCEXT           : 28, // extra field length

    /* The Data descriptor */
    EXTSIG           : 0x08074b50, // "PK\007\008"
    EXTHDR           : 16, // EXT header size
    EXTCRC           : 4, // uncompressed file crc-32 value
    EXTSIZ           : 8, // compressed size
    EXTLEN           : 12, // uncompressed size

    /* The central directory file header */
    CENHDR           : 46, // CEN header size
    CENSIG           : 0x02014b50, // "PK\001\002"
    CENVEM           : 4, // version made by
    CENVER           : 6, // version needed to extract
    CENFLG           : 8, // encrypt, decrypt flags
    CENHOW           : 10, // compression method
    CENTIM           : 12, // modification time (2 bytes time, 2 bytes date)
    CENCRC           : 16, // uncompressed file crc-32 value
    CENSIZ           : 20, // compressed size
    CENLEN           : 24, // uncompressed size
    CENNAM           : 28, // filename length
    CENEXT           : 30, // extra field length
    CENCOM           : 32, // file comment length
    CENDSK           : 34, // volume number start
    CENATT           : 36, // internal file attributes
    CENATX           : 38, // external file attributes (host system dependent)
    CENOFF           : 42, // LOC header offset

    /* The entries in the end of central directory */
    ENDHDR           : 22, // END header size
    ENDSIG           : 0x06054b50, // "PK\005\006"
    ENDSIGFIRST      : 0x50,
    ENDSUB           : 8, // number of entries on this disk
    ENDTOT           : 10, // total number of entries
    ENDSIZ           : 12, // central directory size in bytes
    ENDOFF           : 16, // offset of first CEN header
    ENDCOM           : 20, // zip file comment length
    MAXFILECOMMENT   : 0xFFFF,

    /* The entries in the end of ZIP64 central directory locator */
    ENDL64HDR       : 20, // ZIP64 end of central directory locator header size
    ENDL64SIG       : 0x07064b50, // ZIP64 end of central directory locator signature
    ENDL64SIGFIRST  : 0x50,
    ENDL64OFS       : 8, // ZIP64 end of central directory offset

    /* The entries in the end of ZIP64 central directory */
    END64HDR        : 56, // ZIP64 end of central directory header size
    END64SIG        : 0x06064b50, // ZIP64 end of central directory signature
    END64SIGFIRST   : 0x50,
    END64SUB        : 24, // number of entries on this disk
    END64TOT        : 32, // total number of entries
    END64SIZ        : 40,
    END64OFF        : 48,

    /* Compression methods */
    STORED           : 0, // no compression
    SHRUNK           : 1, // shrunk
    REDUCED1         : 2, // reduced with compression factor 1
    REDUCED2         : 3, // reduced with compression factor 2
    REDUCED3         : 4, // reduced with compression factor 3
    REDUCED4         : 5, // reduced with compression factor 4
    IMPLODED         : 6, // imploded
    // 7 reserved
    DEFLATED         : 8, // deflated
    ENHANCED_DEFLATED: 9, // deflate64
    PKWARE           : 10,// PKWare DCL imploded
    // 11 reserved
    BZIP2            : 12, //  compressed using BZIP2
    // 13 reserved
    LZMA             : 14, // LZMA
    // 15-17 reserved
    IBM_TERSE        : 18, // compressed using IBM TERSE
    IBM_LZ77         : 19, //IBM LZ77 z

    /* General purpose bit flag */
    FLG_ENC          : 0,  // encrypted file
    FLG_COMP1        : 1,  // compression option
    FLG_COMP2        : 2,  // compression option
    FLG_DESC         : 4,  // data descriptor
    FLG_ENH          : 8,  // enhanced deflation
    FLG_STR          : 16, // strong encryption
    FLG_LNG          : 1024, // language encoding
    FLG_MSK          : 4096, // mask header values
    FLG_ENTRY_ENC    : 1,

    /* 4.5 Extensible data fields */
    EF_ID            : 0,
    EF_SIZE          : 2,

    /* Header IDs */
    ID_ZIP64         : 0x0001,
    ID_AVINFO        : 0x0007,
    ID_PFS           : 0x0008,
    ID_OS2           : 0x0009,
    ID_NTFS          : 0x000a,
    ID_OPENVMS       : 0x000c,
    ID_UNIX          : 0x000d,
    ID_FORK          : 0x000e,
    ID_PATCH         : 0x000f,
    ID_X509_PKCS7    : 0x0014,
    ID_X509_CERTID_F : 0x0015,
    ID_X509_CERTID_C : 0x0016,
    ID_STRONGENC     : 0x0017,
    ID_RECORD_MGT    : 0x0018,
    ID_X509_PKCS7_RL : 0x0019,
    ID_IBM1          : 0x0065,
    ID_IBM2          : 0x0066,
    ID_POSZIP        : 0x4690,

    EF_ZIP64_OR_32   : 0xffffffff,
    EF_ZIP64_OR_16   : 0xffff
};

// endregion

// region StreamZip

var StreamZip = function(config) {
    var
        fd,
        fileSize,
        chunkSize,
        ready = false,
        that = this,
        op,
        centralDirectory,
        closed,

        entries = config.storeEntries !== false ? {} : null,
        fileName = config.file;

    open();

    function open() {
        fs.open(fileName, 'r', function(err, f) {
            if (err)
                return that.emit('error', err);
            fd = f;
            fs.fstat(fd, function(err, stat) {
                if (err)
                    return that.emit('error', err);
                fileSize = stat.size;
                chunkSize = config.chunkSize || Math.round(fileSize / 1000);
                chunkSize = Math.max(Math.min(chunkSize, Math.min(128*1024, fileSize)), Math.min(1024, fileSize));
                readCentralDirectory();
            });
        });
    }

    function readUntilFoundCallback(err, bytesRead) {
        if (err || !bytesRead)
            return that.emit('error', err || 'Archive read error');
        var
            buffer = op.win.buffer,
            pos = op.lastPos,
            bufferPosition = pos - op.win.position,
            minPos = op.minPos;
        while (--pos >= minPos && --bufferPosition >= 0) {
            if (buffer.length - bufferPosition >= 4 &&
                buffer[bufferPosition] === op.firstByte) { // quick check first signature byte
                if (buffer.readUInt32LE(bufferPosition) === op.sig) {
                    op.lastBufferPosition = bufferPosition;
                    op.lastBytesRead = bytesRead;
                    op.complete();
                    return;
                }
            }
        }
        if (pos === minPos) {
            return that.emit('error', 'Bad archive');
        }
        op.lastPos = pos + 1;
        op.chunkSize *= 2;
        if (pos <= minPos)
            return that.emit('error', 'Bad archive');
        var expandLength = Math.min(op.chunkSize, pos - minPos);
        op.win.expandLeft(expandLength, readUntilFoundCallback);

    }

    function readCentralDirectory() {
        var totalReadLength = Math.min(consts.ENDHDR + consts.MAXFILECOMMENT, fileSize);
        op = {
            win: new FileWindowBuffer(fd),
            totalReadLength: totalReadLength,
            minPos: fileSize - totalReadLength,
            lastPos: fileSize,
            chunkSize: Math.min(1024, chunkSize),
            firstByte: consts.ENDSIGFIRST,
            sig: consts.ENDSIG,
            complete: readCentralDirectoryComplete
        };
        op.win.read(fileSize - op.chunkSize, op.chunkSize, readUntilFoundCallback);
    }

    function readCentralDirectoryComplete() {
        var buffer = op.win.buffer;
        var pos = op.lastBufferPosition;
        try {
            centralDirectory = new CentralDirectoryHeader();
            centralDirectory.read(buffer.slice(pos, pos + consts.ENDHDR));
            centralDirectory.headerOffset = op.win.position + pos;
            if (centralDirectory.commentLength)
                that.comment = buffer.slice(pos + consts.ENDHDR,
                    pos + consts.ENDHDR + centralDirectory.commentLength).toString();
            else
                that.comment = null;
            that.entriesCount = centralDirectory.volumeEntries;
            that.centralDirectory = centralDirectory;
            if (centralDirectory.volumeEntries === consts.EF_ZIP64_OR_16 && centralDirectory.totalEntries === consts.EF_ZIP64_OR_16
                || centralDirectory.size === consts.EF_ZIP64_OR_32 || centralDirectory.offset === consts.EF_ZIP64_OR_32) {
                readZip64CentralDirectoryLocator();
            } else {
                op = {};
                readEntries();
            }
        } catch (err) {
            that.emit('error', err);
        }
    }

    function readZip64CentralDirectoryLocator() {
        var length = consts.ENDL64HDR;
        if (op.lastBufferPosition > length) {
            op.lastBufferPosition -= length;
            readZip64CentralDirectoryLocatorComplete();
        } else {
            op = {
                win: op.win,
                totalReadLength: length,
                minPos: op.win.position - length,
                lastPos: op.win.position,
                chunkSize: op.chunkSize,
                firstByte: consts.ENDL64SIGFIRST,
                sig: consts.ENDL64SIG,
                complete: readZip64CentralDirectoryLocatorComplete
            };
            op.win.read(op.lastPos - op.chunkSize, op.chunkSize, readUntilFoundCallback);
        }
    }

    function readZip64CentralDirectoryLocatorComplete() {
        var buffer = op.win.buffer;
        var locHeader = new CentralDirectoryLoc64Header();
        locHeader.read(buffer.slice(op.lastBufferPosition, op.lastBufferPosition + consts.ENDL64HDR));
        var readLength = fileSize - locHeader.headerOffset;
        op = {
            win: op.win,
            totalReadLength: readLength,
            minPos: locHeader.headerOffset,
            lastPos: op.lastPos,
            chunkSize: op.chunkSize,
            firstByte: consts.END64SIGFIRST,
            sig: consts.END64SIG,
            complete: readZip64CentralDirectoryComplete
        };
        op.win.read(fileSize - op.chunkSize, op.chunkSize, readUntilFoundCallback);
    }

    function readZip64CentralDirectoryComplete() {
        var buffer = op.win.buffer;
        var zip64cd = new CentralDirectoryZip64Header();
        zip64cd.read(buffer.slice(op.lastBufferPosition, op.lastBufferPosition + consts.END64HDR));
        that.centralDirectory.volumeEntries = zip64cd.volumeEntries;
        that.centralDirectory.totalEntries = zip64cd.totalEntries;
        that.centralDirectory.size = zip64cd.size;
        that.centralDirectory.offset = zip64cd.offset;
        that.entriesCount = zip64cd.volumeEntries;
        op = {};
        readEntries();
    }

    function readEntries() {
        op = {
            win: new FileWindowBuffer(fd),
            pos: centralDirectory.offset,
            chunkSize: chunkSize,
            entriesLeft: centralDirectory.volumeEntries
        };
        op.win.read(op.pos, Math.min(chunkSize, fileSize - op.pos), readEntriesCallback);
    }

    function readEntriesCallback(err, bytesRead) {
        if (err || !bytesRead)
            return that.emit('error', err || 'Entries read error');
        var
            buffer = op.win.buffer,
            bufferPos = op.pos - op.win.position,
            bufferLength = buffer.length,
            entry = op.entry;
        try {
            while (op.entriesLeft > 0) {
                if (!entry) {
                    entry = new ZipEntry();
                    entry.readHeader(buffer, bufferPos);
                    entry.headerOffset = op.win.position + bufferPos;
                    op.entry = entry;
                    op.pos += consts.CENHDR;
                    bufferPos += consts.CENHDR;
                }
                var entryHeaderSize = entry.fnameLen + entry.extraLen + entry.comLen;
                var advanceBytes = entryHeaderSize + (op.entriesLeft > 1 ? consts.CENHDR : 0);
                if (bufferLength - bufferPos < advanceBytes) {
                    op.win.moveRight(chunkSize, readEntriesCallback, bufferPos);
                    op.move = true;
                    return;
                }
                entry.read(buffer, bufferPos);
                if (!config.skipEntryNameValidation) {
                    entry.validateName();
                }
                if (entries)
                    entries[entry.name] = entry;
                that.emit('entry', entry);
                op.entry = entry = null;
                op.entriesLeft--;
                op.pos += entryHeaderSize;
                bufferPos += entryHeaderSize;
            }
            that.emit('ready');
        } catch (err) {
            that.emit('error', err);
        }
    }

    function checkEntriesExist() {
        if (!entries)
            throw new Error('storeEntries disabled');
    }

    Object.defineProperty(this, 'ready', { get: function() { return ready; } });

    this.entry = function(name) {
        checkEntriesExist();
        return entries[name];
    };

    this.entries = function() {
        checkEntriesExist();
        return entries;
    };

    this.stream = function(entry, callback) {
        return this.openEntry(entry, function(err, entry) {
            if (err)
                return callback(err);
            var offset = dataOffset(entry);
            var entryStream = new EntryDataReaderStream(fd, offset, entry.compressedSize);
            if (entry.method === consts.STORED) {
            } else if (entry.method === consts.DEFLATED) {
                entryStream = entryStream.pipe(zlib.createInflateRaw());
            } else {
                return callback('Unknown compression method: ' + entry.method);
            }
            if (canVerifyCrc(entry))
                entryStream = entryStream.pipe(new EntryVerifyStream(entryStream, entry.crc, entry.size));
            callback(null, entryStream);
        }, false);
    };

    this.entryDataSync = function(entry) {
        var err = null;
        this.openEntry(entry, function(e, en) {
            err = e;
            entry = en;
        }, true);
        if (err)
            throw err;
        var
            data = Buffer.alloc(entry.compressedSize),
            bytesRead;
        new FsRead(fd, data, 0, entry.compressedSize, dataOffset(entry), function(e, br) {
            err = e;
            bytesRead = br;
        }).read(true);
        if (err)
            throw err;
        if (entry.method === consts.STORED) {
        } else if (entry.method === consts.DEFLATED || entry.method === consts.ENHANCED_DEFLATED) {
            data = zlib.inflateRawSync(data);
        } else {
            throw new Error('Unknown compression method: ' + entry.method);
        }
        if (data.length !== entry.size)
            throw new Error('Invalid size');
        if (canVerifyCrc(entry)) {
            var verify = new CrcVerify(entry.crc, entry.size);
            verify.data(data);
        }
        return data;
    };

    this.openEntry = function(entry, callback, sync) {
        if (typeof entry === 'string') {
            checkEntriesExist();
            entry = entries[entry];
            if (!entry)
                return callback('Entry not found');
        }
        if (!entry.isFile)
            return callback('Entry is not file');
        if (!fd)
            return callback('Archive closed');
        var buffer = Buffer.alloc(consts.LOCHDR);
        new FsRead(fd, buffer, 0, buffer.length, entry.offset, function(err) {
            if (err)
                return callback(err);
            var readEx;
            try {
                entry.readDataHeader(buffer);
                if (entry.encrypted) {
                    readEx = 'Entry encrypted';
                }
            } catch (ex) {
                readEx = ex
            }
            callback(readEx, entry);
        }).read(sync);
    };

    function dataOffset(entry) {
        return entry.offset + consts.LOCHDR + entry.fnameLen + entry.extraLen;
    }

    function canVerifyCrc(entry) {
        // if bit 3 (0x08) of the general-purpose flags field is set, then the CRC-32 and file sizes are not known when the header is written
        return (entry.flags & 0x8) != 0x8;
    }

    function extract(entry, outPath, callback) {
        that.stream(entry, function (err, stm) {
            if (err) {
                callback(err);
            } else {
                var fsStm, errThrown;
                stm.on('error', function(err) {
                    errThrown = err;
                    if (fsStm) {
                        stm.unpipe(fsStm);
                        fsStm.close(function () {
                            callback(err);
                        });
                    }
                });
                fs.open(outPath, 'w', function(err, fdFile) {
                    if (err)
                        return callback(err || errThrown);
                    if (errThrown) {
                        fs.close(fd, function() {
                            callback(errThrown);
                        });
                        return;
                    }
                    fsStm = fs.createWriteStream(outPath, { fd: fdFile });
                    fsStm.on('finish', function() {
                        that.emit('extract', entry, outPath);
                        if (!errThrown)
                            callback();
                    });
                    stm.pipe(fsStm);
                });
            }
        });
    }

    function createDirectories(baseDir, dirs, callback) {
        if (!dirs.length)
            return callback();
        var dir = dirs.shift();
        dir = path.join(baseDir, path.join.apply(path, dir));
        fs.mkdir(dir, function(err) {
            if (err && err.code !== 'EEXIST')
                return callback(err);
            createDirectories(baseDir, dirs, callback);
        });
    }

    function extractFiles(baseDir, baseRelPath, files, callback, extractedCount) {
        if (!files.length)
            return callback(null, extractedCount);
        var file = files.shift();
        var targetPath = path.join(baseDir, file.name.replace(baseRelPath, ''));
        extract(file, targetPath, function (err) {
            if (err)
                return callback(err, extractedCount);
            extractFiles(baseDir, baseRelPath, files, callback, extractedCount + 1);
        });
    }

    this.extract = function(entry, outPath, callback) {
        var entryName = entry || '';
        if (typeof entry === 'string') {
            entry = this.entry(entry);
            if (entry) {
                entryName = entry.name;
            } else {
                if (entryName.length && entryName[entryName.length - 1] !== '/')
                    entryName += '/';
            }
        }
        if (!entry || entry.isDirectory) {
            var files = [], dirs = [], allDirs = {};
            for (var e in entries) {
                if (Object.prototype.hasOwnProperty.call(entries, e) && e.lastIndexOf(entryName, 0) === 0) {
                    var relPath = e.replace(entryName, '');
                    var childEntry = entries[e];
                    if (childEntry.isFile) {
                        files.push(childEntry);
                        relPath = path.dirname(relPath);
                    }
                    if (relPath && !allDirs[relPath] && relPath !== '.') {
                        allDirs[relPath] = true;
                        var parts = relPath.split('/').filter(function (f) { return f; });
                        if (parts.length)
                            dirs.push(parts);
                        while (parts.length > 1) {
                            parts = parts.slice(0, parts.length - 1);
                            var partsPath = parts.join('/');
                            if (allDirs[partsPath] || partsPath === '.') {
                                break;
                            }
                            allDirs[partsPath] = true;
                            dirs.push(parts);
                        }
                    }
                }
            }
            dirs.sort(function(x, y) { return x.length - y.length; });
            if (dirs.length) {
                createDirectories(outPath, dirs, function (err) {
                    if (err)
                        callback(err);
                    else
                        extractFiles(outPath, entryName, files, callback, 0);
                });
            } else {
                extractFiles(outPath, entryName, files, callback, 0);
            }
        } else {
            fs.stat(outPath, function(err, stat) {
                if (stat && stat.isDirectory())
                    extract(entry, path.join(outPath, path.basename(entry.name)), callback);
                else
                    extract(entry, outPath, callback);
            });
        }
    };

    this.close = function(callback) {
        if (closed || !fd) {
            closed = true;
            if (callback)
                callback();
        } else {
            closed = true;
            fs.close(fd, function(err) {
                fd = null;
                if (callback)
                    callback(err);
            });
        }
    };

    var originalEmit = events.EventEmitter.prototype.emit;
    this.emit = function() {
        if (!closed) {
            return originalEmit.apply(this, arguments);
        }
    };
};

StreamZip.setFs = function(customFs) {
    fs = customFs;
};

util.inherits(StreamZip, events.EventEmitter);

// endregion

// region CentralDirectoryHeader

var CentralDirectoryHeader = function() {
};

CentralDirectoryHeader.prototype.read = function(data) {
    if (data.length != consts.ENDHDR || data.readUInt32LE(0) != consts.ENDSIG)
        throw new Error('Invalid central directory');
    // number of entries on this volume
    this.volumeEntries = data.readUInt16LE(consts.ENDSUB);
    // total number of entries
    this.totalEntries = data.readUInt16LE(consts.ENDTOT);
    // central directory size in bytes
    this.size = data.readUInt32LE(consts.ENDSIZ);
    // offset of first CEN header
    this.offset = data.readUInt32LE(consts.ENDOFF);
    // zip file comment length
    this.commentLength = data.readUInt16LE(consts.ENDCOM);
};

// endregion

// region CentralDirectoryLoc64Header

var CentralDirectoryLoc64Header = function() {
};

CentralDirectoryLoc64Header.prototype.read = function(data) {
    if (data.length != consts.ENDL64HDR || data.readUInt32LE(0) != consts.ENDL64SIG)
        throw new Error('Invalid zip64 central directory locator');
    // ZIP64 EOCD header offset
    this.headerOffset = Util.readUInt64LE(data, consts.ENDSUB);
};

// endregion

// region CentralDirectoryZip64Header

var CentralDirectoryZip64Header = function() {
};

CentralDirectoryZip64Header.prototype.read = function(data) {
    if (data.length != consts.END64HDR || data.readUInt32LE(0) != consts.END64SIG)
        throw new Error('Invalid central directory');
    // number of entries on this volume
    this.volumeEntries = Util.readUInt64LE(data, consts.END64SUB);
    // total number of entries
    this.totalEntries = Util.readUInt64LE(data, consts.END64TOT);
    // central directory size in bytes
    this.size = Util.readUInt64LE(data, consts.END64SIZ);
    // offset of first CEN header
    this.offset = Util.readUInt64LE(data, consts.END64OFF);
};

// endregion

// region ZipEntry

var ZipEntry = function() {
};

function toBits(dec, size) {
    var b = (dec >>> 0).toString(2);
    while (b.length < size)
        b = '0' + b;
    return b.split('');
}

function parseZipTime(timebytes, datebytes) {
    var timebits = toBits(timebytes, 16);
    var datebits = toBits(datebytes, 16);

    var mt = {
        h: parseInt(timebits.slice(0,5).join(''), 2),
        m: parseInt(timebits.slice(5,11).join(''), 2),
        s: parseInt(timebits.slice(11,16).join(''), 2) * 2,
        Y: parseInt(datebits.slice(0,7).join(''), 2) + 1980,
        M: parseInt(datebits.slice(7,11).join(''), 2),
        D: parseInt(datebits.slice(11,16).join(''), 2),
    };
    var dt_str = [mt.Y, mt.M, mt.D].join('-') + ' ' + [mt.h, mt.m, mt.s].join(':') + ' GMT+0';
    return new Date(dt_str).getTime();
}

ZipEntry.prototype.readHeader = function(data, offset) {
    // data should be 46 bytes and start with "PK 01 02"
    if (data.length < offset + consts.CENHDR || data.readUInt32LE(offset) != consts.CENSIG) {
        throw new Error('Invalid entry header');
    }
    // version made by
    this.verMade = data.readUInt16LE(offset + consts.CENVEM);
    // version needed to extract
    this.version = data.readUInt16LE(offset + consts.CENVER);
    // encrypt, decrypt flags
    this.flags = data.readUInt16LE(offset + consts.CENFLG);
    // compression method
    this.method = data.readUInt16LE(offset + consts.CENHOW);
    // modification time (2 bytes time, 2 bytes date)
    var timebytes = data.readUInt16LE(offset + consts.CENTIM);
    var datebytes = data.readUInt16LE(offset + consts.CENTIM + 2);
    this.time = parseZipTime(timebytes, datebytes);

    // uncompressed file crc-32 value
    this.crc = data.readUInt32LE(offset + consts.CENCRC);
    // compressed size
    this.compressedSize = data.readUInt32LE(offset + consts.CENSIZ);
    // uncompressed size
    this.size = data.readUInt32LE(offset + consts.CENLEN);
    // filename length
    this.fnameLen = data.readUInt16LE(offset + consts.CENNAM);
    // extra field length
    this.extraLen = data.readUInt16LE(offset + consts.CENEXT);
    // file comment length
    this.comLen = data.readUInt16LE(offset + consts.CENCOM);
    // volume number start
    this.diskStart = data.readUInt16LE(offset + consts.CENDSK);
    // internal file attributes
    this.inattr = data.readUInt16LE(offset + consts.CENATT);
    // external file attributes
    this.attr = data.readUInt32LE(offset + consts.CENATX);
    // LOC header offset
    this.offset = data.readUInt32LE(offset + consts.CENOFF);
};

ZipEntry.prototype.readDataHeader = function(data) {
    // 30 bytes and should start with "PK\003\004"
    if (data.readUInt32LE(0) != consts.LOCSIG) {
        throw new Error('Invalid local header');
    }
    // version needed to extract
    this.version = data.readUInt16LE(consts.LOCVER);
    // general purpose bit flag
    this.flags = data.readUInt16LE(consts.LOCFLG);
    // compression method
    this.method = data.readUInt16LE(consts.LOCHOW);
    // modification time (2 bytes time ; 2 bytes date)
    var timebytes = data.readUInt16LE(consts.LOCTIM);
    var datebytes = data.readUInt16LE(consts.LOCTIM + 2);
    this.time = parseZipTime(timebytes, datebytes);

    // uncompressed file crc-32 value
    this.crc = data.readUInt32LE(consts.LOCCRC) || this.crc;
    // compressed size
    var compressedSize = data.readUInt32LE(consts.LOCSIZ);
    if (compressedSize && compressedSize !== consts.EF_ZIP64_OR_32) {
        this.compressedSize = compressedSize;
    }
    // uncompressed size
    var size = data.readUInt32LE(consts.LOCLEN);
    if (size && size !== consts.EF_ZIP64_OR_32) {
        this.size = size;
    }
    // filename length
    this.fnameLen = data.readUInt16LE(consts.LOCNAM);
    // extra field length
    this.extraLen = data.readUInt16LE(consts.LOCEXT);
};

ZipEntry.prototype.read = function(data, offset) {
    this.name = data.slice(offset, offset += this.fnameLen).toString();
    var lastChar = data[offset - 1];
    this.isDirectory = (lastChar == 47) || (lastChar == 92);

    if (this.extraLen) {
        this.readExtra(data, offset);
        offset += this.extraLen;
    }
    this.comment = this.comLen ? data.slice(offset, offset + this.comLen).toString() : null;
};

ZipEntry.prototype.validateName = function() {
    if (/\\|^\w+:|^\/|(^|\/)\.\.(\/|$)/.test(this.name)) {
        throw new Error('Malicious entry: ' + this.name);
    }
};

ZipEntry.prototype.readExtra = function(data, offset) {
    var signature, size, maxPos = offset + this.extraLen;
    while (offset < maxPos) {
        signature = data.readUInt16LE(offset);
        offset += 2;
        size = data.readUInt16LE(offset);
        offset += 2;
        if (consts.ID_ZIP64 === signature) {
            this.parseZip64Extra(data, offset, size);
        }
        offset += size;
    }
};

ZipEntry.prototype.parseZip64Extra = function(data, offset, length) {
    if (length >= 8 && this.size === consts.EF_ZIP64_OR_32) {
        this.size = Util.readUInt64LE(data, offset);
        offset += 8; length -= 8;
    }
    if (length >= 8 && this.compressedSize === consts.EF_ZIP64_OR_32) {
        this.compressedSize = Util.readUInt64LE(data, offset);
        offset += 8; length -= 8;
    }
    if (length >= 8 && this.offset === consts.EF_ZIP64_OR_32) {
        this.offset = Util.readUInt64LE(data, offset);
        offset += 8; length -= 8;
    }
    if (length >= 4 && this.diskStart === consts.EF_ZIP64_OR_16) {
        this.diskStart = data.readUInt32LE(offset);
        // offset += 4; length -= 4;
    }
};

Object.defineProperty(ZipEntry.prototype, 'encrypted', {
    get: function() { return (this.flags & consts.FLG_ENTRY_ENC) == consts.FLG_ENTRY_ENC; }
});

Object.defineProperty(ZipEntry.prototype, 'isFile', {
    get: function() { return !this.isDirectory; }
});

// endregion

// region FsRead

var FsRead = function(fd, buffer, offset, length, position, callback) {
    this.fd = fd;
    this.buffer = buffer;
    this.offset = offset;
    this.length = length;
    this.position = position;
    this.callback = callback;
    this.bytesRead = 0;
    this.waiting = false;
};

FsRead.prototype.read = function(sync) {
    if (StreamZip.debug) {
        console.log('read', this.position, this.bytesRead, this.length, this.offset);
    }
    this.waiting = true;
    var err;
    if (sync) {
        try {
            var bytesRead = fs.readSync(this.fd, this.buffer, this.offset + this.bytesRead,
                this.length - this.bytesRead, this.position + this.bytesRead);
        } catch (e) {
            err = e;
        }
        this.readCallback(sync, err, err ? bytesRead : null);
    } else {
        fs.read(this.fd, this.buffer, this.offset + this.bytesRead,
            this.length - this.bytesRead, this.position + this.bytesRead,
            this.readCallback.bind(this, sync));
    }
};

FsRead.prototype.readCallback = function(sync, err, bytesRead) {
    if (typeof bytesRead === 'number')
        this.bytesRead += bytesRead;
    if (err || !bytesRead || this.bytesRead === this.length) {
        this.waiting = false;
        return this.callback(err, this.bytesRead);
    } else {
        this.read(sync);
    }
};

// endregion

// region FileWindowBuffer

var FileWindowBuffer = function(fd) {
    this.position = 0;
    this.buffer = Buffer.alloc(0);

    var fsOp = null;

    this.checkOp = function() {
        if (fsOp && fsOp.waiting)
            throw new Error('Operation in progress');
    };

    this.read = function(pos, length, callback) {
        this.checkOp();
        if (this.buffer.length < length)
            this.buffer = Buffer.alloc(length);
        this.position = pos;
        fsOp = new FsRead(fd, this.buffer, 0, length, this.position, callback).read();
    };

    this.expandLeft = function(length, callback) {
        this.checkOp();
        this.buffer = Buffer.concat([Buffer.alloc(length), this.buffer]);
        this.position -= length;
        if (this.position < 0)
            this.position = 0;
        fsOp = new FsRead(fd, this.buffer, 0, length, this.position, callback).read();
    };

    this.expandRight = function(length, callback) {
        this.checkOp();
        var offset = this.buffer.length;
        this.buffer = Buffer.concat([this.buffer, Buffer.alloc(length)]);
        fsOp = new FsRead(fd, this.buffer, offset, length, this.position + offset, callback).read();
    };

    this.moveRight = function(length, callback, shift) {
        this.checkOp();
        if (shift) {
            this.buffer.copy(this.buffer, 0, shift);
        } else {
            shift = 0;
        }
        this.position += shift;
        fsOp = new FsRead(fd, this.buffer, this.buffer.length - shift, shift, this.position + this.buffer.length - shift, callback).read();
    };
};

// endregion

// region EntryDataReaderStream

var EntryDataReaderStream = function(fd, offset, length) {
    stream.Readable.prototype.constructor.call(this);
    this.fd = fd;
    this.offset = offset;
    this.length = length;
    this.pos = 0;
    this.readCallback = this.readCallback.bind(this);
};

util.inherits(EntryDataReaderStream, stream.Readable);

EntryDataReaderStream.prototype._read = function(n) {
    var buffer = Buffer.alloc(Math.min(n, this.length - this.pos));
    if (buffer.length) {
        fs.read(this.fd, buffer, 0, buffer.length, this.offset + this.pos, this.readCallback);
    } else {
        this.push(null);
    }
};

EntryDataReaderStream.prototype.readCallback = function(err, bytesRead, buffer) {
    this.pos += bytesRead;
    if (err) {
        this.emit('error', err);
        this.push(null);
    } else if (!bytesRead) {
        this.push(null);
    } else {
        if (bytesRead !== buffer.length)
            buffer = buffer.slice(0, bytesRead);
        this.push(buffer);
    }
};

// endregion

// region EntryVerifyStream

var EntryVerifyStream = function(baseStm, crc, size) {
    stream.Transform.prototype.constructor.call(this);
    this.verify = new CrcVerify(crc, size);
    var that = this;
    baseStm.on('error', function(e) {
        that.emit('error', e);
    });
};

util.inherits(EntryVerifyStream, stream.Transform);

EntryVerifyStream.prototype._transform = function(data, encoding, callback) {
    var err;
    try {
        this.verify.data(data);
    } catch (e) {
        err = e;
    }
    callback(err, data);
};

// endregion

// region CrcVerify

var CrcVerify = function(crc, size) {
    this.crc = crc;
    this.size = size;
    this.state = {
        crc: ~0,
        size: 0
    };
};

CrcVerify.prototype.data = function(data) {
    var crcTable = CrcVerify.getCrcTable();
    var crc = this.state.crc, off = 0, len = data.length;
    while (--len >= 0)
        crc = crcTable[(crc ^ data[off++]) & 0xff] ^ (crc >>> 8);
    this.state.crc = crc;
    this.state.size += data.length;
    if (this.state.size >= this.size) {
        var buf = Buffer.alloc(4);
        buf.writeInt32LE(~this.state.crc & 0xffffffff, 0);
        crc = buf.readUInt32LE(0);
        if (crc !== this.crc)
            throw new Error('Invalid CRC');
        if (this.state.size !== this.size)
            throw new Error('Invalid size');
    }
};

CrcVerify.getCrcTable = function() {
    var crcTable = CrcVerify.crcTable;
    if (!crcTable) {
        CrcVerify.crcTable = crcTable = [];
        var b = Buffer.alloc(4);
        for (var n = 0; n < 256; n++) {
            var c = n;
            for (var k = 8; --k >= 0; )
                if ((c & 1) != 0)  { c = 0xedb88320 ^ (c >>> 1); } else { c = c >>> 1; }
            if (c < 0) {
                b.writeInt32LE(c, 0);
                c = b.readUInt32LE(0);
            }
            crcTable[n] = c;
        }
    }
    return crcTable;
};

// endregion

// region Util

var Util = {
    readUInt64LE: function(buffer, offset) {
        return (buffer.readUInt32LE(offset + 4) * 0x0000000100000000) + buffer.readUInt32LE(offset);
    }
};

// endregion

// region exports

module.exports = StreamZip;

// endregion


/***/ })

/******/ });