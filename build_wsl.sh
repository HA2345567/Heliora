#!/bin/bash
set -x
export PATH="$PATH:/home/harshu369/.avm/bin:/home/harshu369/.cargo/bin:/home/harshu369/.local/share/solana/install/active_release/bin"
cd ~/heliora_build
anchor clean
anchor build --arch sbf
