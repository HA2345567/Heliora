#!/bin/bash
export PATH="$PATH:/home/harshu369/.cargo/bin"
cd ~
rm -rf test_rust_build
cargo new test_rust_build
cd test_rust_build
cargo build
