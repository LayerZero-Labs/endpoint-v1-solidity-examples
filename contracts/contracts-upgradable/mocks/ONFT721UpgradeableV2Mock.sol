// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8;

import "../token/ONFT721/ONFT721UpgradeableV2.sol";

contract ONFT721UpgradeableV2Mock is ONFT721UpgradeableV2 {
    function initialize(string memory _name, string memory _symbol, address _lzEndpoint) public initializer {
        ONFT721UpgradeableV2.initializeONFT721Upgradeable(_name, _symbol, _lzEndpoint);
    }
    function mint(address _tokenOwner, uint _newId) external payable {
        _safeMint(_tokenOwner, _newId);
    }
}
