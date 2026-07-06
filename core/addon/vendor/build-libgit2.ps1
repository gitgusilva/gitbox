# Build a fully self-contained static libgit2 (with static mbedTLS for HTTPS)
# for GitBox's native addon on Windows (MSVC).
#
# Windows counterpart of build-libgit2.sh. Same recipe: static mbedTLS as the
# TLS backend, statically linked into libgit2, so gitbox_addon.node needs NO
# external DLL beyond the CRT. Run inside an MSVC dev environment (so cmake,
# cl.exe and lib.exe are on PATH), e.g. via ilammy/msvc-dev-cmd in CI or a
# "x64 Native Tools" prompt locally.
#
# Re-runnable. Override versions with $env:LIBGIT2_TAG / $env:MBEDTLS_TAG.
# Force a clean rebuild with $env:FORCE_REBUILD=1.
$ErrorActionPreference = "Stop"

$Here        = $PSScriptRoot
$LIBGIT2_TAG = if ($env:LIBGIT2_TAG) { $env:LIBGIT2_TAG } else { "v1.9.4" }
$MBEDTLS_TAG = if ($env:MBEDTLS_TAG) { $env:MBEDTLS_TAG } else { "v3.6.6" }
# Ninja (single-config) picks up cl.exe/lib.exe from the active MSVC dev
# environment. This sidesteps the "Visual Studio 17 2022" generator's flaky
# VS-instance detection on CI runners.
$Gen         = "Ninja"

$MbedSrc    = Join-Path $Here "mbedtls\src"
$MbedBuild  = Join-Path $Here "mbedtls\build"
$MbedPrefix = Join-Path $Here "mbedtls\install"

$Src    = Join-Path $Here "libgit2\src"
$Build  = Join-Path $Here "libgit2\build"
$Prefix = Join-Path $Here "libgit2\install"

$Git2Lib = Join-Path $Prefix "lib\git2.lib"
$MbedLib = Join-Path $MbedPrefix "lib\mbedtls_all.lib"

# Skip when both final artifacts already exist (e.g. restored from CI cache).
if ((Test-Path $Git2Lib) -and (Test-Path $MbedLib) -and (-not $env:FORCE_REBUILD)) {
  Write-Host ">> vendored libs already present; skipping (set FORCE_REBUILD=1 to rebuild)"
  exit 0
}

# ----- 1. static mbedTLS (TLS backend for libgit2 HTTPS) --------------------
Write-Host ">> mbedTLS $MBEDTLS_TAG  ->  $MbedPrefix"
if (-not (Test-Path (Join-Path $MbedSrc "CMakeLists.txt"))) {
  Remove-Item -Recurse -Force $MbedSrc -ErrorAction Ignore
  git clone --depth 1 --branch $MBEDTLS_TAG --recurse-submodules `
    https://github.com/Mbed-TLS/mbedtls.git $MbedSrc
  if ($LASTEXITCODE -ne 0) { throw "mbedTLS clone failed" }
}
Remove-Item -Recurse -Force $MbedBuild, $MbedPrefix -ErrorAction Ignore
cmake -S $MbedSrc -B $MbedBuild -G $Gen `
  -DCMAKE_BUILD_TYPE=Release `
  -DCMAKE_POLICY_DEFAULT_CMP0091=NEW `
  -DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded `
  -DCMAKE_INSTALL_PREFIX="$MbedPrefix" `
  -DENABLE_TESTING=OFF `
  -DENABLE_PROGRAMS=OFF `
  -DUSE_STATIC_MBEDTLS_LIBRARY=ON `
  -DUSE_SHARED_MBEDTLS_LIBRARY=OFF
if ($LASTEXITCODE -ne 0) { throw "mbedTLS configure failed" }
cmake --build $MbedBuild --parallel
if ($LASTEXITCODE -ne 0) { throw "mbedTLS build failed" }
cmake --install $MbedBuild
if ($LASTEXITCODE -ne 0) { throw "mbedTLS install failed" }

# Merge every mbedTLS static lib (mbedtls, mbedx509, mbedcrypto and any
# optional accelerators like everest/p256m) into one archive so the addon
# links a single, complete unit regardless of which extras mbedTLS emitted.
$mbedLibs = Get-ChildItem (Join-Path $MbedPrefix "lib\*.lib") |
  Where-Object { $_.Name -ne "mbedtls_all.lib" } |
  ForEach-Object { $_.FullName }
if (-not $mbedLibs) { throw "no mbedTLS .lib files were produced" }
Write-Host ">> merging mbedTLS libs -> mbedtls_all.lib"
& lib "/OUT:$MbedLib" $mbedLibs
if ($LASTEXITCODE -ne 0) { throw "lib.exe merge of mbedTLS failed" }

# ----- 2. static libgit2 with HTTPS=mbedTLS ---------------------------------
Write-Host ">> libgit2 $LIBGIT2_TAG  ->  $Prefix"
if (-not (Test-Path (Join-Path $Src "CMakeLists.txt"))) {
  Remove-Item -Recurse -Force $Src -ErrorAction Ignore
  git clone --depth 1 --branch $LIBGIT2_TAG https://github.com/libgit2/libgit2.git $Src
  if ($LASTEXITCODE -ne 0) { throw "libgit2 clone failed" }
}
Remove-Item -Recurse -Force $Build, $Prefix -ErrorAction Ignore
cmake -S $Src -B $Build -G $Gen `
  -DCMAKE_BUILD_TYPE=Release `
  -DCMAKE_POLICY_DEFAULT_CMP0091=NEW `
  -DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded `
  -DCMAKE_INSTALL_PREFIX="$Prefix" `
  -DCMAKE_PREFIX_PATH="$MbedPrefix" `
  -DMBEDTLS_ROOT_DIR="$MbedPrefix" `
  -DBUILD_SHARED_LIBS=OFF `
  -DBUILD_TESTS=OFF `
  -DBUILD_CLI=OFF `
  -DBUILD_EXAMPLES=OFF `
  -DUSE_SSH=OFF `
  -DUSE_HTTPS=mbedTLS `
  -DWINHTTP=OFF `
  -DUSE_NTLMCLIENT=OFF `
  -DUSE_SHA1=CollisionDetection `
  -DUSE_SHA256=Builtin `
  -DUSE_BUNDLED_ZLIB=ON `
  -DREGEX_BACKEND=builtin
if ($LASTEXITCODE -ne 0) { throw "libgit2 configure failed" }
cmake --build $Build --parallel
if ($LASTEXITCODE -ne 0) { throw "libgit2 build failed" }
cmake --install $Build
if ($LASTEXITCODE -ne 0) { throw "libgit2 install failed" }

Write-Host ">> installed:"
Get-ChildItem $Git2Lib, $MbedLib | Format-Table FullName, Length
Write-Host ">> DONE"
