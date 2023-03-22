// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import "hardhat-deploy/solc_0.8/proxy/Proxied.sol";
import "../token/oft/OFTUpgradeable.sol";

contract ExampleOFTUpgradeable is Initializable, OFTUpgradeable, Proxied {
    function initialize(string memory _name, string memory _symbol, uint _initialSupply, address _lzEndpoint) public initializer {
        __OFTUpgradeable_init(_name, _symbol, _lzEndpoint);
        _mint(_msgSender(), _initialSupply);
    }
}
