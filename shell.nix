{ pkgs ? import <nixpkgs> {} }:
  pkgs.mkShell {
    buildInputs = with pkgs; [
      rustup
      electron_15
      sqlite
    ];
    LD_LIBRARY_PATH = "/run/opengl-driver/lib:${with pkgs; lib.makeLibraryPath [
      gcc-unwrapped
    ]}";
  }
