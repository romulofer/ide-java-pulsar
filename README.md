# ide-java-pulsar
[![CI](https://github.com/romulofer/ide-java-pulsar/actions/workflows/ci.yml/badge.svg)](https://github.com/romulofer/ide-java-pulsar/actions/workflows/ci.yml)

Java language support for [Pulsar](https://pulsar-edit.dev), powered by the [Eclipse JDT language server](https://github.com/eclipse/eclipse.jdt.ls).

![Screenshot of ide-java-pulsar](https://user-images.githubusercontent.com/118951/30291233-0b6e04ac-96e7-11e7-9aa8-3cc6143537c1.png)

## Installation

Install from Pulsar's package manager, or from the command line:

```
ppm install ide-java-pulsar
```

You should also install [atom-ide-base](https://web.pulsar-edit.dev/packages/atom-ide-base) to surface the language features (completion, diagnostics, outline, and so on) in the editor.

## Requirements

* [Pulsar](https://pulsar-edit.dev)
* Java 17 or later on your `PATH`, or set the `Java Home` setting (or the `JDK_HOME` / `JAVA_HOME` environment variables). The Eclipse JDT language server needs Java 17 to run; it can still build projects that target older Java versions.

On first use the package downloads the Eclipse JDT language server automatically. To reuse an existing install instead, set the `Server Path` setting to a folder that contains `plugins/` and `config_*`.

## Features

* Auto completion
* Code format
* Diagnostics (errors & warnings)
* Document outline
* Find references
* Go to definition
* Hover
* Reference highlighting
* Signature help

## Contributing
Always feel free to help out. Whether it's [filing bugs and feature requests](https://github.com/romulofer/ide-java-pulsar/issues/new) or working on some of the [open issues](https://github.com/romulofer/ide-java-pulsar/issues), your help is welcome.

## License
MIT License. See [the license](LICENSE.md) for more details.
