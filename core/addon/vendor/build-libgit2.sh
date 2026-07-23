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
# SSH (git@ URLs) works too: libssh2 is built statically against the same
# mbedTLS, so no OpenSSL and no system libssh2 are required at runtime.
#
# Re-runnable. Override versions with LIBGIT2_TAG / MBEDTLS_TAG / LIBSSH2_TAG /
# OPENSSL_TAG.
#
# BUILD MACHINE REQUIREMENTS: cmake, a C/C++ toolchain, and perl with the
# modules OpenSSL's Configure needs. Debian/Ubuntu ship them with perl itself;
# Fedora splits them out, so there:
#   sudo dnf install perl-FindBin perl-IPC-Cmd perl-File-Compare \
#                    perl-File-Copy perl-Pod-Html
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIBGIT2_TAG="${LIBGIT2_TAG:-v1.9.4}"
MBEDTLS_TAG="${MBEDTLS_TAG:-v3.6.6}"
LIBSSH2_TAG="${LIBSSH2_TAG:-libssh2-1.11.1}"
OPENSSL_TAG="${OPENSSL_TAG:-openssl-3.5.4}"

MBED_SRC="$HERE/mbedtls/src"
MBED_BUILD="$HERE/mbedtls/build"
MBED_PREFIX="$HERE/mbedtls/install"

SSL_SRC="$HERE/openssl/src"
SSL_PREFIX="$HERE/openssl/install"

SSH_SRC="$HERE/libssh2/src"
SSH_BUILD="$HERE/libssh2/build"
SSH_PREFIX="$HERE/libssh2/install"

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

# ----- 2. static OpenSSL (crypto backend for libssh2 only) ------------------
# HTTPS keeps using mbedTLS; SSH cannot. libssh2's mbedTLS backend defines
# LIBSSH2_ED25519 as 0 and only parses the modern "OPENSSH PRIVATE KEY" format
# for ECDSA — so an ed25519 key (ssh-keygen's default) or an RSA key written by
# OpenSSH 7.8+ would simply be rejected. Verified against a real server: ECDSA
# authenticated, RSA-in-OpenSSH-format did not. OpenSSL covers every key type
# users actually have, so it is built statically here and linked into libssh2.
echo ">> OpenSSL $OPENSSL_TAG  ->  $SSL_PREFIX"
if [ ! -f "$SSL_SRC/Configure" ]; then
  rm -rf "$SSL_SRC"
  git clone --depth 1 --branch "$OPENSSL_TAG" \
    https://github.com/openssl/openssl.git "$SSL_SRC"
fi
if [ ! -f "$SSL_PREFIX/lib/libcrypto.a" ] && [ ! -f "$SSL_PREFIX/lib64/libcrypto.a" ]; then
  rm -rf "$SSL_PREFIX"
  ( cd "$SSL_SRC" && \
    ./Configure no-shared no-tests no-docs no-legacy \
      --prefix="$SSL_PREFIX" --openssldir="$SSL_PREFIX/ssl" && \
    make -j"$(nproc)" && make install_sw )
fi
if [ -d "$SSL_PREFIX/lib64" ] && [ ! -e "$SSL_PREFIX/lib" ]; then ln -s lib64 "$SSL_PREFIX/lib"; fi

# ----- 3. static libssh2 (SSH transport for git@ URLs) ----------------------
echo ">> libssh2 $LIBSSH2_TAG  ->  $SSH_PREFIX"
if [ ! -f "$SSH_SRC/CMakeLists.txt" ]; then
  rm -rf "$SSH_SRC"
  git clone --depth 1 --branch "$LIBSSH2_TAG" \
    https://github.com/libssh2/libssh2.git "$SSH_SRC"
fi
rm -rf "$SSH_BUILD" "$SSH_PREFIX"
cmake -S "$SSH_SRC" -B "$SSH_BUILD" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX="$SSH_PREFIX" \
  -DCMAKE_POSITION_INDEPENDENT_CODE=ON \
  -DCMAKE_PREFIX_PATH="$SSL_PREFIX" \
  -DOPENSSL_ROOT_DIR="$SSL_PREFIX" \
  -DOPENSSL_USE_STATIC_LIBS=ON \
  -DCRYPTO_BACKEND=OpenSSL \
  -DBUILD_SHARED_LIBS=OFF \
  -DBUILD_STATIC_LIBS=ON \
  -DBUILD_EXAMPLES=OFF \
  -DBUILD_TESTING=OFF \
  -DENABLE_ZLIB_COMPRESSION=OFF
cmake --build "$SSH_BUILD" --parallel "$(nproc)"
cmake --install "$SSH_BUILD"
if [ -d "$SSH_PREFIX/lib64" ] && [ ! -e "$SSH_PREFIX/lib" ]; then ln -s lib64 "$SSH_PREFIX/lib"; fi

# ----- 4. static libgit2 with HTTPS=mbedTLS + SSH=libssh2 -------------------
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
  -DCMAKE_PREFIX_PATH="$MBED_PREFIX;$SSH_PREFIX" \
  -DMBEDTLS_ROOT_DIR="$MBED_PREFIX" \
  -DBUILD_SHARED_LIBS=OFF \
  -DBUILD_TESTS=OFF \
  -DBUILD_CLI=OFF \
  -DBUILD_EXAMPLES=OFF \
  -DUSE_SSH=libssh2 \
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
