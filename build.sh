#! /usr/bin/env bash
set -ev;

cargo clean --manifest-path marker-network-site-generator/Cargo.toml
cargo build --target x86_64-unknown-linux-musl --release --manifest-path marker-network-site-generator/Cargo.toml


rm -r ./dist || true;
mkdir ./dist

cp ./marker-network-site-generator/target/x86_64-unknown-linux-musl/release/marker_network_site_generator ./dist/marker_network_site_generator
cp -r ./marker-network-site-generator/starter ./dist/
cp -r ./marker-network-site-generator/themes ./dist/
