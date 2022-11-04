// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../token/oft/v2/composable/ComposableOFTV2.sol";

/// @title A LayerZero OmnichainFungibleToken example of BasedOFT
/// @notice Use this contract only on the BASE CHAIN. It locks tokens on source, on outgoing send(), and unlocks tokens when receiving from other chains.
contract ExampleComposableOFTV2 is ComposableOFTV2 {
    constructor(address _layerZeroEndpoint, uint _initialSupply, uint8 _sharedDecimals) ComposableOFTV2("ExampleComposableOFT", "OFT", _sharedDecimals, _layerZeroEndpoint) {
        _mint(_msgSender(), _initialSupply);
    }
}
