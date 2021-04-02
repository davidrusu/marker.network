{ pkgs ? import <nixpkgs> {} }:
  pkgs.mkShell {
    buildInputs = with pkgs; [
      nodejs
      electron_12
      sqlite
    ];
    LD_LIBRARY_PATH = "/run/opengl-driver/lib:${with pkgs; lib.makeLibraryPath [
      gcc-unwrapped
    ]}";
  }
