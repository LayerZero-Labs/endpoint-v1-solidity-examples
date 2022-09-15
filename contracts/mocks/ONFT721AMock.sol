// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.4;

import "../token/onft/ONFT721A.sol";

contract ONFT721AMock is ONFT721A {
    constructor(string memory _name, string memory _symbol, address _layerZeroEndpoint) ONFT721A(_name, _symbol, _layerZeroEndpoint) {}

    function mint(uint _amount) external payable {
        _safeMint(msg.sender, _amount, "");
    }
}
