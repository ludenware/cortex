# Vendored qpdf binaries

Used by [`electron/pdf-encrypt.ts`](../../electron/pdf-encrypt.ts) for native
PDF password-protection on export. Invoked only via `execFile` with an
argument array (never a shell string) — see that file's doc comment for why
these are vendored directly rather than via an npm wrapper.

qpdf version: **12.4.0**

## win/ and linux/ — official qpdf release

Downloaded directly from `https://github.com/qpdf/qpdf/releases/download/v12.4.0/`
and verified against the release's own published `qpdf-12.4.0.sha256`:

- `win/` ← `qpdf-12.4.0-mingw64.zip` (`bin/qpdf.exe` + its 4 sibling mingw
  runtime DLLs — self-contained, no MSVC redistributable needed; Windows
  resolves DLLs from the executable's own directory by default).
- `linux/` ← `qpdf-12.4.0-bin-linux-x86_64.zip` (`bin/qpdf` + the full
  `lib/` it ships with). `pdf-encrypt.ts` sets `LD_LIBRARY_PATH` to the
  sibling `lib/` dir when invoking, since Linux's loader — unlike macOS's
  `@executable_path` or Windows' default search order — doesn't consult the
  executable's own directory automatically.

qpdf's official releases do **not** publish a macOS binary (checked via
`gh api repos/qpdf/qpdf/releases/latest` — only Linux and Windows assets
exist), so `mac/` is sourced differently:

## mac/ — built from the Homebrew bottle, re-vendored

`brew install qpdf` (bottle, same 12.4.0 source qpdf itself publishes) was
used to obtain an arm64 macOS build, since no official prebuilt exists. The
Homebrew binary dynamically links against Homebrew-provided paths
(`/opt/homebrew/opt/...`), which won't exist on a machine without Homebrew,
so it was re-linked into a self-contained bundle:

1. Copied `qpdf`, `libqpdf.30.dylib`, `libjpeg.8.dylib` (from `jpeg-turbo`),
   and `libcrypto.3.dylib` (from `openssl@3`) — qpdf's only non-system
   dependencies (`otool -L`; `libz`/`libc++`/`libSystem` are always present
   on macOS and were left untouched).
2. Rewrote every reference between them with `install_name_tool` to
   `@executable_path/libs/...` (from the binary) and `@loader_path/...`
   (between the libs), so resolution never depends on Homebrew's install
   paths existing.
3. Re-signed each file ad-hoc (`codesign --sign -`) — required for the
   rewritten binaries to load at all on Apple Silicon.
4. Verified fully standalone: encrypted and decrypted a test PDF with the
   vendored binary, confirmed `otool -L` shows zero remaining
   `/opt/homebrew` paths anywhere in the chain.

**Known gap**: this `mac/` build is **arm64-only** (built on Apple Silicon,
via Homebrew's arm64 bottle). The app's own `package.json` `build.mac`
config doesn't currently pin an architecture either, so this matches the
existing build's scope — but if/when Intel or universal Mac builds are
added, `mac/` will need an x86_64 (or universal) qpdf re-vendored the same
way, from an Intel Homebrew bottle.

## SHA256

```
9ac787a28597e8428289a12ba3fedafd74bdfb4b4da1be814722faf76f14f21b  linux/qpdf
1ae3d582f75ac136e9ff223acf7e1a1c6fcea7dfd792f4b3b401888082e47ec8  linux/lib/libffi.so.8
1333e5627c3e0c9c67079abf8f46df1e9369e4d6aed800723e852b657467fbb9  linux/lib/libgnutls.so.30
5cf6f6da565d6f8132918f7c9b3558239e4193ea2299eb53082d92458f56b42e  linux/lib/libhogweed.so.6
a8e6f7c0d5770294830db63b7dc8fd005362e20b109c74ee600689d5f8317324  linux/lib/libidn2.so.0
21661bf728676700a61be235403cedc0c6f61247b45baa685904414a5ecd8f69  linux/lib/libjpeg.so.8
250d19ee04109927927fbbe8a3be63572cd242481dc6cb7106279461244ccf33  linux/lib/libnettle.so.8
d3967fbc00699270729bce50a138ab2a69cf574e471979d8d714f6d8df06f679  linux/lib/libp11-kit.so.0
40bc77ad1cf7a085ceb36a0c3d98315807cd5403116e346a5e9a94731351fb5e  linux/lib/libqpdf.so.30
40bc77ad1cf7a085ceb36a0c3d98315807cd5403116e346a5e9a94731351fb5e  linux/lib/libqpdf.so.30.4.0
28a1d44689c3e88c0b8004d97387b75880e8d75e9d7ea8c968b29a3653caec52  linux/lib/libtasn1.so.6
a821050079d149d6f0a0e58fd90c27eba52f259da80075c6b96c965af0b4a224  linux/lib/libunistring.so.2
cef7500c1220acb2e6916101a0d64c58fc260d39ed99d323b7718a553f39d620  mac/qpdf
94cee2739b099a05885038036a53e12aa167f521026c2470d83675a3d007d436  mac/libs/libcrypto.3.dylib
de3e8a971e88dbeeba69bb79d95338ce0e06f27307ec3ef336e5cb83ca49348b  mac/libs/libjpeg.8.dylib
d1444ee829475db1c6e9fc92de38c5535da7408cedcf448f99e9d295a1166d2b  mac/libs/libqpdf.30.dylib
832b73b371db31908f4dc7a5c1411c066d3e030121807377d739803f4d211b24  win/qpdf.exe
970ead48587b3fcd2651706c846597a4ff212357da2f2dd54787cfeacc4837cc  win/qpdf30.dll
b37c1770c8ca092700875845b34918803ee6311573eba1c32ff4b1166e4a0e1e  win/libgcc_s_seh-1.dll
887c21dbe2a211ac4d1a790e4f608b7dee27fae12352856963004e7a715d2e6c  win/libstdc++-6.dll
d54ed5baa6d339e28fe18c0106caffd110ac42612908593e07211d7bb48f5e79  win/libwinpthread-1.dll
```
