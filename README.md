# Marker Network

## Setting up for development

Install [rustup](https://rustup.rs/)

```bash
git clone https://github.com/davidrusu/marker.network
git submodule update --init marker-network-site-generator/

# on linux
rustup target install x86_64-unknown-linux-musl


npm install
npm run build
```

### Updating submodules

```
git submodule update --remote
```
