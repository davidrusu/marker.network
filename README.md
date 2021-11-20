<img src="https://user-images.githubusercontent.com/1832378/142739772-34011e39-4d73-4aa8-a9ba-090261bef67b.png" width=64px />

# Marker Network

Design and publish a website from your reMarkable Tablet.


https://user-images.githubusercontent.com/1832378/142739832-aff24232-a114-4bfd-ae07-7d651a6c0b88.mp4


# Support
<a href="https://www.buymeacoffee.com/davidrusu" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

Buy me a coffee to help offset marker.network's server bills and fund future feature development!

## Setting up for development

Install [rustup](https://rustup.rs/)

```bash
git clone https://github.com/davidrusu/marker.network
git submodule update --init marker-network-site-generator/

# on linux
rustup target install x86_64-unknown-linux-musl
# on ubuntu
sudo apt-get install musl-tools

npm install
npm run build
```

### Updating submodules

```
git submodule update --remote
```
