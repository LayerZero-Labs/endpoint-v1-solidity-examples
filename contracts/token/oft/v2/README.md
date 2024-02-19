## Clarification on OFT Versions

### OFTV1.2

> [!IMPORTANT]
> Please note that this repo contains OFTV1.2, and is NOT the LayerZero V2 OFT Standard, but rather a second version of OFT built on Endpoint V1.

We recommend new developers use the [LayerZero V2 OFT Standard](https://github.com/LayerZero-Labs/LayerZero-v2/blob/main/oapp/contracts/oft/OFT.sol) (found in the LayerZero V2 repo) over both the Endpoint V1 OFT V1 and Endpoint V1 OFT V1.2 implementations, as the protocol update comes with improved interfaces, gas optimizations, and greater composability.

#### When to use LayerZero V2 OFT

With the release of LayerZero V2, you should consider only using this V2 OFT Standard for your deployments. LayerZero V2 offers developers a smoother developer experience and optimizations to core protocol contracts.

Read the full [LayerZero V2 Overview](https://docs.layerzero.network/contracts/oft) to learn more.

#### When to use LayerZero V1 OFT V1.2

What if you want to build an Omnichain Fungible Token that supports EVMs and non-EVMs (e.g., Aptos)? In this case, you should use our Endpoint V1 OFT V1.2 which supports both. This version has fees, shared decimals, and composability built in. This Endpoint V1 version of OFT is currently being used in projects such as BTCb.
