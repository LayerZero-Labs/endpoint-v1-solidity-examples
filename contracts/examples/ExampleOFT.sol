// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../token/oft/OFT.sol";

/// @title A LayerZero OmnichainFungibleToken example of BasedOFT
/// @notice Use this contract only on the BASE CHAIN. It locks tokens on source, on outgoing send(), and unlocks tokens when receiving from other chains.
contract ExampleOFT is OFT {
    constructor(address _layerZeroEndpoint) OFT("ExampleOFT", "OFT", _layerZeroEndpoint) {}

    function mintTokens(address _to, uint256 _amount) external {
        _mint(_to, _amount);
    }
}
