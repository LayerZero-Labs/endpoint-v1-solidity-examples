// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../OFT.sol";

// @dev example implementation inheriting a OFT
contract OFTMock is OFT {
    constructor(address _layerZeroEndpoint) OFT("MockOFT", "OFT", _layerZeroEndpoint) {}

    // @dev WARNING public mint function, do not use this in production
    function mintTokens(address _to, uint256 _amount) external {
        _mint(_to, _amount);
    }
}
