const cp = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const {shell} = require('electron')
const {AutoLanguageClient, DownloadFile} = require('@savetheclocktower/atom-languageclient')

const {actionProviderComposer, actionProviders} = require('./providers')
const {
  autoImportProvider,
  removeUnusedImportProvider
} = actionProviders

const serverDownloadUrl = 'https://download.eclipse.org/jdtls/milestones/1.43.0/jdt-language-server-1.43.0-202412191447.tar.gz'
const serverDownloadSize = 48216630
const minJavaRuntime = 17
const bytesToMegabytes = 1024 * 1024

class JavaLanguageClient extends AutoLanguageClient {
  getGrammarScopes () { return [ 'source.java' ] }
  getLanguageName () { return 'Java' }
  getServerName () { return 'Eclipse JDT' }
  // List of preferences available at:
  // https://github.com/eclipse/eclipse.jdt.ls/blob/master/org.eclipse.jdt.ls.core/src/org/eclipse/jdt/ls/core/internal/preferences/Preferences.java
  getRootConfigurationKey() { return 'ide-java-pulsar.server' }
  mapConfigurationObject(configuration) { return {java: configuration} }

  constructor () {
    super()
    this.statusElement = document.createElement('span')
    this.statusElement.className = 'inline-block'

    this.commands = {
      'java.ignoreIncompleteClasspath': () => {
        atom.config.set('ide-java-pulsar.server.errors.incompleteClasspath.severity', 'ignore')
      },
      'java.ignoreIncompleteClasspath.help': () => { shell.openExternal('https://github.com/romulofer/ide-java-pulsar/wiki/Incomplete-Classpath-Warning') },
      'java.projectConfiguration.status': (command, connection) => {
        // Arguments:
        // - 0: Object containing build file URI
        // - 1: 'disabled' for Never, 'interactive' for Now, 'automatic' for Always
        const [uri, status] = command.arguments
        const statusMap = {
          0: 'disabled',
          1: 'interactive',
          2: 'automatic',
        }
        atom.config.set('ide-java-pulsar.server.configuration.updateBuildConfiguration', statusMap[status])

        if (status !== 0) {
          connection.sendCustomRequest('java/projectConfigurationUpdate', uri)
        }
      }
    }

    // Migrate settings from the old ide-java namespace (the package was renamed
    // ide-java -> ide-java-pulsar). Copy the whole legacy namespace to the new
    // one on first run, then drop the old. Remove after a few versions.
    const legacyConfig = atom.config.get('ide-java')
    if (legacyConfig != null) {
      if (atom.config.get('ide-java-pulsar') == null) {
        atom.config.set('ide-java-pulsar', legacyConfig)
      }
      atom.config.unset('ide-java')
    }

    // Migrate ide-java-pulsar.errors.incompleteClasspathSeverity -> ide-java-pulsar.server.errors.incompleteClasspath.severity
    // Migration added in v0.10.0; feel free to remove after a few versions
    const severity = atom.config.get('ide-java-pulsar.errors.incompleteClasspathSeverity')
    if (severity) {
      atom.config.unset('ide-java-pulsar.errors.incompleteClasspathSeverity')
      atom.config.unset('ide-java-pulsar.errors')
      atom.config.set('ide-java-pulsar.server.errors.incompleteClasspath.severity', severity)
    }
  }

  startServerProcess (projectPath) {
    const config = { 'win32': 'win', 'darwin': 'mac', 'linux': 'linux' }[process.platform]
    if (config == null) {
      throw Error(`${this.getServerName()} not supported on ${process.platform}`)
    }

    // Users can point at an existing JDT LS install; otherwise use the bundled
    // (downloaded on first run) server under ../server.
    const customServerPath = atom.config.get('ide-java-pulsar.serverPath')
    const useBundledServer = !customServerPath
    const serverHome = useBundledServer ? path.join(__dirname, '..', 'server') : customServerPath
    const command = this.getJavaCommand()
    let javaVersion

    return this.checkJavaVersion(command)
      .then(foundJavaVersion => {
        javaVersion = foundJavaVersion
        return useBundledServer ? this.installServerIfRequired(serverHome) : Promise.resolve()
      })
      .then(() => this.getOrCreateDataDir(projectPath))
      .then(dataDir => {
        const args = []
        if (javaVersion >= 9) {
          args.push(
            '--add-modules=ALL-SYSTEM',
            '--add-opens', 'java.base/java.util=ALL-UNNAMED',
            '--add-opens', 'java.base/java.lang=ALL-UNNAMED'
          )
        }

        const extraArgs = this.parseArgs(atom.config.get('ide-java-pulsar.virtualMachine.extraArgs'))
        args.push(...extraArgs)

        const launcher = this.getLauncherJar(serverHome)
        if (launcher == null) {
          throw Error(`Could not find the ${this.getServerName()} launcher jar under ${serverHome}`)
        }

        args.push(
          '-jar', launcher,
          '-configuration', path.join(serverHome, `config_${config}`),
          '-data', dataDir
        )

        this.logger.debug(`starting "${command} ${args.join(' ')}"`)
        const childProcess = cp.spawn(command, args, { cwd: serverHome })
        this.captureServerErrors(childProcess)
        childProcess.on('close', exitCode => {
          if (!childProcess.killed) {
            atom.notifications.addError('IDE-Java language server stopped unexpectedly.', {
              dismissable: true,
              description: this.processStdErr ? `<code>${this.processStdErr}</code>` : `Exit code ${exitCode}`
            })
          }
          this.updateStatusBar('Stopped')
        })
        return childProcess
      }
    )
  }

  checkJavaVersion (command) {
    return new Promise((resolve, reject) => {
      const childProcess = cp.spawn(command, [ '-showversion', '-version' ])
      childProcess.on('error', err => {
        this.showJavaRequirements(
          'IDE-Java could not launch your Java runtime.',
          err.code == 'ENOENT'
            ? `No Java runtime found at <b>${command}</b>.`
            : `Could not spawn the Java runtime <b>${command}</b>.`
        )
        reject()
      })
      let stdErr = '', stdOut = ''
      childProcess.stderr.on('data', chunk => stdErr += chunk.toString())
      childProcess.stdout.on('data', chunk => stdOut += chunk.toString())
      childProcess.on('close', exitCode => {
        const output = stdErr + '\n' + stdOut
        if (exitCode === 0 && output.length > 2) {
          const version = this.getJavaVersionFromOutput(output)
          if (version == null) {
            this.showJavaRequirements(
              `IDE-Java requires Java ${minJavaRuntime} but could not determine your Java version.`,
              `Could not parse the Java '--showVersion' output <pre>${output}</pre>.`
            )
            reject()
          }
          if (version >= minJavaRuntime) {
            this.logger.debug(`Using Java ${version} from ${command}`)
            resolve(version)
          } else {
            this.showJavaRequirements(
              `IDE-Java requires Java ${minJavaRuntime} or later but found ${version}`,
              `If you have Java ${minJavaRuntime} installed please Set Java Path correctly. If you do not please Download Java ${minJavaRuntime} or later and install it.`
            )
            reject()
          }
        } else {
          atom.notifications.addError('IDE-Java encounted an error using the Java runtime.', {
            dismissable: true,
            description: stdErr != '' ? `<code>${stdErr}</code>` : `Exit code ${exitCode}`
          })
          reject()
        }
      })
    })
  }

  getJavaVersionFromOutput (output) {
    const match = output.match(/ version "(\d+(.\d+)?)(.\d+)?(_\d+)?(?:-\w+)?"/)
    return match != null && match.length > 0 ? Number(match[1]) : null
  }

  showJavaRequirements (title, description) {
    atom.notifications.addError(title, {
      dismissable: true,
      buttons: [
        { text: 'Set Java Path', onDidClick: () => atom.workspace.open('atom://config/packages/ide-java-pulsar') },
        { text: 'Download Java', onDidClick: () => shell.openExternal('https://adoptium.net/temurin/releases/?version=17') },
      ],
      description: `${description}<p>If you have Java installed please Set Java Path correctly. If you do not please Download Java ${minJavaRuntime} or later and install it.</p>`
    })
  }

  getJavaCommand () {
    const javaPath = this.getJavaPath()
    return javaPath == null ? 'java' : path.join(javaPath, 'bin', 'java')
  }

  getJavaPath () {
    return (new Array(
      atom.config.get('ide-java-pulsar.javaHome'),
      process.env['JDK_HOME'],
      process.env['JAVA_HOME'])
    ).find(j => j)
  }

  getOrCreateDataDir (projectPath) {
    const dataDir = path.join(os.tmpdir(), `atom-java-${encodeURIComponent(projectPath)}`)
    return this.fileExists(dataDir)
      .then(exists => { if (!exists) fs.mkdirSync(dataDir, { recursive: true }) })
      .then(() => dataDir)
  }

  installServerIfRequired (serverHome) {
    return this.isServerInstalled(serverHome)
      .then(doesExist => { if (!doesExist) return this.installServer(serverHome) })
  }

  isServerInstalled (serverHome) {
    return Promise.resolve(this.getLauncherJar(serverHome) != null)
  }

  // Resolve the Equinox launcher jar without pinning its version: the filename
  // (org.eclipse.equinox.launcher_<version>.jar) changes every JDT LS release.
  getLauncherJar (serverHome) {
    const pluginsDir = path.join(serverHome, 'plugins')
    let files
    try {
      files = fs.readdirSync(pluginsDir)
    } catch (error) {
      return null
    }
    const launcher = files.find(f => /^org\.eclipse\.equinox\.launcher_.*\.jar$/.test(f))
    return launcher != null ? path.join(pluginsDir, launcher) : null
  }

  installServer (serverHome) {
    const localFileName = path.join(serverHome, 'download.tar.gz')
    const decompress = require('decompress')
    const provideInstallStatus = (bytesDone, percent) => {
      this.updateInstallStatus(`downloading ${Math.floor(serverDownloadSize / bytesToMegabytes)} MB (${percent}% done)`)
    }
    return this.fileExists(serverHome)
      .then(doesExist => { if (!doesExist) fs.mkdirSync(serverHome, { recursive: true }) })
      .then(() => DownloadFile(serverDownloadUrl, localFileName, provideInstallStatus, serverDownloadSize))
      .then(() => this.updateInstallStatus('unpacking'))
      .then(() => decompress(localFileName, serverHome))
      .then(() => { if (this.getLauncherJar(serverHome) == null) throw Error(`Failed to install the ${this.getServerName()} language server`) })
      .then(() => this.updateInstallStatus('installed'))
      .then(() => fs.unlinkSync(localFileName))
  }

  preInitialization(connection) {
    let started = false
    connection.onCustom('language/status', (status) => {
      if (started) return
      this.updateStatusBar(status.message)
      // Additional messages can be generated after the server is ready
      // that we don't want to show (for example, build refreshes)
      if (status.type === 'Started') {
        started = true
      }
    })
    connection.onCustom('language/actionableNotification', (notification) => this.actionableNotification(notification, connection))
  }

  getInitializeParams(projectPath, process) {
    const params = super.getInitializeParams(projectPath, process);
    if (!params.initializationOptions) {
      params.initializationOptions = {};
    }
    params.initializationOptions.bundles = this.collectJavaExtensions();
    return params;
  }

  collectJavaExtensions() {
    return atom.packages.getLoadedPackages()
        .filter(pkg => Array.isArray(pkg.metadata.javaExtensions))
        .map(pkg => pkg.metadata.javaExtensions.map(p => path.resolve(pkg.path, p)))
        .reduce(e => e.concat([]), []);
  }

  updateInstallStatus (status) {
    const isComplete = status === 'installed'
    if (this.busySignalService) {
      if (this._installSignal == null) {
        if (!isComplete) {
          this._installSignal = this.busySignalService.reportBusy(status, { revealTooltip: true })
        }
      } else {
        if (isComplete) {
          this._installSignal.dispose()
        } else {
          this._installSignal.setTitle(status)
        }
      }
    } else {
      this.updateStatusBar(status)
    }
  }

  updateStatusBar (text) {
    this.statusElement.textContent = `${this.name} ${text}`
    if (!this.statusTile && this.statusBar) {
      this.statusTile = this.statusBar.addRightTile({ item: this.statusElement, priority: 1000 })
    }
  }

  actionableNotification (notification, connection) {
    const options = { dismissable: true, detail: this.getServerName() }
    if (Array.isArray(notification.commands)) {
      options.buttons = notification.commands.map(command => ({
        text: command.title,
        onDidClick: () => onActionableButton(command)
      }))
    }

    const notificationDialog = this.createNotification(notification.severity, notification.message, options)

    const onActionableButton = (command) => {
      const commandFunction = this.commands[command.command]
      if (commandFunction != null) {
        commandFunction(command, connection)
      } else {
        console.log(`Unknown actionableNotification command '${command.command}'`)
      }
      notificationDialog.dismiss()
    }
  }

  createNotification (severity, message, options) {
    switch (severity) {
      case 1: return atom.notifications.addError(message, options)
      case 2: return atom.notifications.addWarning(message, options)
      case 3: return atom.notifications.addInfo(message, options)
      case 4: console.log(message)
    }
  }

  consumeStatusBar (statusBar) {
    this.statusBar = statusBar
  }

  provideCodeActions() {
    return actionProviderComposer(
      this,
      autoImportProvider,
      removeUnusedImportProvider
    )
  }

  fileExists (path) {
    return new Promise(resolve => {
      fs.access(path, fs.R_OK, error => {
        resolve(!error || error.code !== 'ENOENT')
      })
    })
  }

  deleteFileIfExists (path) {
    return new Promise((resolve, reject) => {
      fs.unlink(path, error => {
        if (error && error.code !== 'ENOENT') { reject(error) } else { resolve() }
      })
    })
  }

  parseArgs(argsLine) {
    if (!argsLine) return []

    // Split the args into an array based on whitespace outside of double-quotes
    const args = argsLine.match(/(?:[^\s"]+|"[^"]*")+/g)
    if (args === null) return []

    // Remove double quotes
    return args.map(arg => arg.replace(/(\\)?"/g, (a, b) => a ? b : '').replace(/(\\)"/g, '"'))
  }
}

module.exports = new JavaLanguageClient()
