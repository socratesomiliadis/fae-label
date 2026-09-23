# Faethon Labeller

Label and certificate management with a React UI, .NET 10 API, PostgreSQL and a Windows print helper.

See the [Greek usage guide](docs/user-guide/faethon-odigos-chrisis.pdf) for operating instructions, or its [editable source and rebuild instructions](docs/user-guide/README.md).

Development is supported on Windows and macOS. See [local setup and testing](docs/running-locally.md) for prerequisites and data transfer instructions.

```sh
node scripts/dev.mjs start
node scripts/dev.mjs test
```

Physical printing and new Microsoft Access extraction require Windows.

For a single Windows PC with a desktop shortcut and no Docker, see [Windows deployment](docs/windows-deployment.md). Build its self-contained release folder with `node scripts/package-windows.mjs`.
