// SPDX-License-Identifier: GPL-3.0-only

pragma solidity ^0.8.4;

// this interfaace should be implemented by any User Application contract
// to receive a LayerZero message.
interface ILayerZeroReceiver {

    function lzReceive(
        uint16 _srcChainId,
        bytes calldata _srcAddress,
        uint64 nonce,
        bytes calldata _payload
    ) external;

}