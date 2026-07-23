{
  "targets": [
    {
      "target_name": "gitbox_addon",
      "sources": ["src/addon.cc"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "<(module_root_dir)/vendor/libgit2/install/include"
      ],
      "dependencies": ["<!(node -p \"require('node-addon-api').gyp\")"],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc": ["-std=c++17"],
      "cflags_cc!": ["-fno-exceptions"],
      "defines": ["NAPI_CPP_EXCEPTIONS"],
      "xcode_settings": {
        "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
        "CLANG_CXX_LIBRARY": "libc++",
        "MACOSX_DEPLOYMENT_TARGET": "10.13"
      },
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1
        }
      },
      "conditions": [
        ["OS=='linux'", {
          "libraries": [
            "<(module_root_dir)/vendor/libgit2/install/lib/libgit2.a",
            "<(module_root_dir)/vendor/libssh2/install/lib/libssh2.a",
            "<(module_root_dir)/vendor/mbedtls/install/lib/libmbedtls.a",
            "<(module_root_dir)/vendor/mbedtls/install/lib/libmbedx509.a",
            "<(module_root_dir)/vendor/mbedtls/install/lib/libmbedcrypto.a",
            "-lrt"
          ],
          "ldflags": [
            "-Wl,-Bsymbolic",
            "-Wl,--exclude-libs,ALL"
          ]
        }],
        ["OS=='mac'", {
          "libraries": [
            "<(module_root_dir)/vendor/libgit2/install/lib/libgit2.a",
            "<(module_root_dir)/vendor/libssh2/install/lib/libssh2.a",
            "<(module_root_dir)/vendor/mbedtls/install/lib/libmbedtls.a",
            "<(module_root_dir)/vendor/mbedtls/install/lib/libmbedx509.a",
            "<(module_root_dir)/vendor/mbedtls/install/lib/libmbedcrypto.a"
          ]
        }],
        ["OS=='win'", {
          "libraries": [
            "<(module_root_dir)/vendor/libgit2/install/lib/git2.lib",
            "<(module_root_dir)/vendor/mbedtls/install/lib/mbedtls_all.lib",
            "ws2_32.lib",
            "advapi32.lib",
            "crypt32.lib",
            "rpcrt4.lib",
            "secur32.lib",
            "ole32.lib",
            "bcrypt.lib",
            "user32.lib"
          ]
        }]
      ]
    }
  ]
}
