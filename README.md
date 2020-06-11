# MQL Compile Action

[![Release][github-release-image]][github-release-link]
[![Status][gha-image-action-master]][gha-link-action-master]
[![Status][gha-image-lint-master]][gha-link-lint-master]
[![Status][gha-image-test-master]][gha-link-test-master]
[![Telegram Channel][tg-channel-image]][tg-channel-link]
[![Telegram Chat][tg-chat-image]][tg-chat-link]
[![Edit][gitpod-image]][gitpod-link]

This GitHub Action compiles MQL programs.

For full documentation, please read: [GitHub Actions Documentation](https://help.github.com/en/actions).

## Usage

This action is only supported on [Windows images](https://github.com/actions/virtual-environments).

### Latest release

```yaml
runs-on: windows-latest
steps:
  - uses: fx31337/mql-compile-action@v1
```

### Specific release

```yaml
runs-on: windows-latest
steps:
  - uses: fx31337/mql-compile-action@v1.0.0
```

Note: Check *Releases* for more details.

### Latest development version

```yaml
runs-on: windows-latest
steps:
  - uses: fx31337/mql-compile-action@master
```

### Overriding default inputs

```yaml
runs-on: windows-latest
steps:
  - uses: fx31337/mql-compile-action@master
    with:
        path: 'path/Dummy.mq5'
        log-file: 'results.log'
        ignore-warnings: true
        verbose: true
```

## Inputs

### `path` (string)

Path to folder or file to compile.

Default: `.` (all files in the current folder are compiled).

### `mt-version` (string)

MetaTrader platform version to use. Default: *5.0.0.2361*.

### `mt-cleanup` (bool)

Whether to remove extracted metaeditor files after compilation. Default: *true*.

### `ignore-warnings` (bool)

Whether to ignore compilation warnings.

### `log-file` (string)

Specifies log filename for compilation messages.

### `check-syntax-only` (bool)

Whether to skip generating binary file and only check for syntax errors.

### `verbose` (bool)

Enables verbose mode (to print more messages). Default: *false*.

### Support

- For bugs/features, raise a [new issue at GitHub](https://github.com/EA31337/MQL-Compile-Action/issues).
- Join our [Telegram group](https://t.me/EA31337) and [channel](https://t.me/EA31337_Announcements) for help.

<!-- Named links -->

[github-release-image]: https://img.shields.io/github/release/FX31337/MQL-Compile-Action.svg?logo=github
[github-release-link]: https://github.com/FX31337/MQL-Compile-Action/releases

[tg-channel-image]: https://img.shields.io/badge/Telegram-news-0088CC.svg?logo=telegram
[tg-channel-link]: https://t.me/EA31337_News
[tg-chat-image]: https://img.shields.io/badge/Telegram-chat-0088CC.svg?logo=telegram
[tg-chat-link]: https://t.me/EA31337

[gha-link-action-master]: https://github.com/FX31337/MQL-Compile-Action/actions?query=workflow%3AAction+branch%3Amaster
[gha-image-action-master]: https://github.com/FX31337/MQL-Compile-Action/workflows/Action/badge.svg
[gha-link-lint-master]: https://github.com/FX31337/MQL-Compile-Action/actions?query=workflow%3ALint+branch%3Amaster
[gha-image-lint-master]: https://github.com/FX31337/MQL-Compile-Action/workflows/Lint/badge.svg
[gha-link-test-master]: https://github.com/FX31337/MQL-Compile-Action/actions?query=workflow%3ATest+branch%3Amaster
[gha-image-test-master]: https://github.com/FX31337/MQL-Compile-Action/workflows/Test/badge.svg

[gitpod-image]: https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod
[gitpod-link]: https://gitpod.io/#https://github.com/FX31337/MQL-Compile-Action
