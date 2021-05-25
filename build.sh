#! /usr/bin/env bash
set -ev;


rm -rf ./dist || true;
mkdir ./dist

# cargo clean --manifest-path marker-network-site-generator/Cargo.toml

if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    cargo build --target x86_64-unknown-linux-musl --release --manifest-path marker-network-site-generator/Cargo.toml

    cp ./marker-network-site-generator/target/x86_64-unknown-linux-musl/release/marker_network_site_generator ./dist/marker_network_site_generator
elif [[ "$OSTYPE" == "msys"* ]]; then
    echo "Building site generator for $OSTYPE"
    cargo build --release --manifest-path marker-network-site-generator/Cargo.toml
    cp ./marker-network-site-generator/target/release/marker_network_site_generator.exe ./dist/marker_network_site_generator.exe

else
    echo "Building site generator for $OSTYPE"
    cargo build --release --manifest-path marker-network-site-generator/Cargo.toml
    cp ./marker-network-site-generator/target/release/marker_network_site_generator ./dist/marker_network_site_generator
fi


cp -r ./marker-network-site-generator/starter ./dist/
cp -r ./marker-network-site-generator/themes ./dist/
