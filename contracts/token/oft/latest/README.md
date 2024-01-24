## Endpoint V1 OFT: Latest

> **NOTE:** This document should be read in conjunction with the <a href="https://layerzero.gitbook.io/docs/evm-guides/oft-walkthrough">LayerZero V1 OFT Docs</a>.

This set of interfaces, contracts, and utilities are all related to the OFT (Omnichain Fungible Token) Endpoint V1 implementation, designed for seamless fungible token transfers across multiple blockchains.

There are a few core contracts that implement the behavior specified in the OFT V2:

* **{OFTV2}**: the main contract that combines `BaseOFTV2` with `ERC20`, implementing the OFT functionalities.
* {BaseOFTV2}: the base abstract contract that provides the essential functionality for omnichain token transfer.
* {{OFTCoreV2}}: the core contract that implements baseline logic for debiting and crediting tokens across multiple chains.
* {{NonblockingLzApp}}: the generic message passing standard to send and receive arbitrary pieces of data between LayerZero contracts.
* {ERC20}: the standard ERC-20 implementation from OpenZeppelin, providing basic token functionalities like transfer, balance tracking, and allowances.

Additionally there are multiple custom extensions, including:

* **{ProxyOFTV2}**: an implementation that allows an already deployed ERC20 to expand to any supported chain as a native token.
* {NativeOFTV2}: support for native gas token transfers.
* {OFTWithFee}: support for custom fees on token transfer.

### Core

{{OFTV2}}

{{BaseOFTV2}}

{{OFTCoreV2}}

{{IOFTV2}}

{{ERC20}}

> **NOTE:** This core set of contracts is designed to be unopinionated, allowing developers to access the internal functions in `OFTV2.sol`, `BaseOFTV2.sol`, and `OFTCoreV2.sol`, and expose them as external functions in the way they prefer.

### Extensions

{{OFTWithFee}}

{{ProxyOFTWithFee}}

{{NativeOFTV2}}

{{NativeOFTWithFee}}

> **NOTE:** We encourage developers to explore the internal workings of the `OFTV2` contract to fully utilize its capabilities in omnichain environments.
