// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import "hardhat-deploy/solc_0.8/proxy/Proxied.sol";
import "../token/oft/v2/OFTV2Upgradable.sol";

contract ExampleOFTv2Upgradeable is Initializable, OFTV2Upgradable, Proxied {
    function initialize(string memory _name, string memory _symbol, uint8 _sharedDecimals, uint _initialSupply, address _lzEndpoint) public initializer {
        __OFTV2Upgradable_init(_name, _symbol, _sharedDecimals, _lzEndpoint);
        _mint(_msgSender(), _initialSupply);
    }
}
