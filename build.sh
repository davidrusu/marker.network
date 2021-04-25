#! /usr/bin/env bash
set -ev;

cargo build --target x86_64-unknown-linux-musl --release --manifest-path marker-network-site-generator/Cargo.toml


rm -r ./dist || true;
mkdir ./dist

cp ./marker-network-site-generator/target/x86_64-unknown-linux-musl/release/marker-network-site-generator ./dist/marker-network-site-generator
cp -r ./marker-network-site-generator/starter ./dist/
cp -r ./marker-network-site-generator/themes ./dist/
