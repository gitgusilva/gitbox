#!/usr/bin/env bash
# Build a fully self-contained static libgit2 (with static mbedTLS for HTTPS)
# for GitBox's native addon.
#
# Goal: GitBox must NOT require the git CLI on the user's machine. That means
# network transport (fetch/pull/push/clone) is done NATIVELY via libgit2, so
# libgit2 needs an HTTPS/TLS backend. We build mbedTLS statically and link it
# into libgit2, which links into gitbox_addon.node — leaving NO external .so
# beyond libc/libstdc++. Portable AppImage + Flatpak + Windows from one recipe.
#
# SSH (git@ URLs) is a later phase (static libssh2); HTTPS covers token auth.
#
# Re-runnable. Override versions with LIBGIT2_TAG / MBEDTLS_TAG.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIBGIT2_TAG="${LIBGIT2_TAG:-v1.9.4}"
MBEDTLS_TAG="${MBEDTLS_TAG:-v3.6.6}"

MBED_SRC="$HERE/mbedtls/src"
MBED_BUILD="$HERE/mbedtls/build"
MBED_PREFIX="$HERE/mbedtls/install"

SRC="$HERE/libgit2/src"
BUILD="$HERE/libgit2/build"
PREFIX="$HERE/libgit2/install"

# ----- 1. static mbedTLS (TLS backend for libgit2 HTTPS) --------------------
echo ">> mbedTLS $MBEDTLS_TAG  ->  $MBED_PREFIX"
if [ ! -f "$MBED_SRC/CMakeLists.txt" ]; then
  rm -rf "$MBED_SRC"
  git clone --depth 1 --branch "$MBEDTLS_TAG" --recurse-submodules \
    https://github.com/Mbed-TLS/mbedtls.git "$MBED_SRC"
fi
rm -rf "$MBED_BUILD" "$MBED_PREFIX"
cmake -S "$MBED_SRC" -B "$MBED_BUILD" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX="$MBED_PREFIX" \
  -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
  -DENABLE_TESTING=OFF \
  -DENABLE_PROGRAMS=OFF \
  -DUSE_STATIC_MBEDTLS_LIBRARY=ON \
  -DUSE_SHARED_MBEDTLS_LIBRARY=OFF
cmake --build "$MBED_BUILD" --parallel "$(nproc)"
cmake --install "$MBED_BUILD"
if [ -d "$MBED_PREFIX/lib64" ] && [ ! -e "$MBED_PREFIX/lib" ]; then ln -s lib64 "$MBED_PREFIX/lib"; fi

# ----- 2. static libgit2 with HTTPS=mbedTLS ---------------------------------
echo ">> libgit2 $LIBGIT2_TAG  ->  $PREFIX"
if [ ! -f "$SRC/CMakeLists.txt" ]; then
  rm -rf "$SRC"
  git clone --depth 1 --branch "$LIBGIT2_TAG" https://github.com/libgit2/libgit2.git "$SRC"
fi

rm -rf "$BUILD" "$PREFIX"
cmake -S "$SRC" -B "$BUILD" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX="$PREFIX" \
  -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
  -DCMAKE_PREFIX_PATH="$MBED_PREFIX" \
  -DMBEDTLS_ROOT_DIR="$MBED_PREFIX" \
  -DBUILD_SHARED_LIBS=OFF \
  -DBUILD_TESTS=OFF \
  -DBUILD_CLI=OFF \
  -DBUILD_EXAMPLES=OFF \
  -DUSE_SSH=OFF \
  -DUSE_HTTPS=mbedTLS \
  -DUSE_NTLMCLIENT=OFF \
  -DUSE_SHA1=CollisionDetection \
  -DUSE_SHA256=Builtin \
  -DUSE_BUNDLED_ZLIB=ON \
  -DREGEX_BACKEND=builtin

cmake --build "$BUILD" --parallel "$(nproc)"
cmake --install "$BUILD"

# Normalize lib dir: some distros install to lib64. binding.gyp references
# install/lib, so guarantee it resolves regardless of the host convention.
if [ -d "$PREFIX/lib64" ] && [ ! -e "$PREFIX/lib" ]; then
  ln -s lib64 "$PREFIX/lib"
fi

echo ">> installed:"
ls -la "$PREFIX/lib"/libgit2.a "$MBED_PREFIX/lib"/libmbed*.a 2>/dev/null || true
echo ">> DONE"
