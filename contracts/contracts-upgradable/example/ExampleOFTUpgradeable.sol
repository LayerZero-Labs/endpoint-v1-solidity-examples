// SPDX-License-Identifier: MIT

pragma solidity ^0.8.2;

import "hardhat-deploy/solc_0.8/proxy/Proxied.sol";
import "../token/OFT/OFTUpgradeable.sol";

contract ExampleOFTUpgradeable is Initializable, OFTUpgradeable, Proxied {
    function initialize(string memory _name, string memory _symbol, uint _initialSupply, address _lzEndpoint) public initializer {
        __ExampleOFTUpgradeable_init(_name, _symbol, _initialSupply, _lzEndpoint);
    }

    function __ExampleOFTUpgradeable_init(string memory _name, string memory _symbol, uint _initialSupply, address _lzEndpoint) internal onlyInitializing {
        __Ownable_init();
        __OFTUpgradeable_init(_name, _symbol, _lzEndpoint);
        __ExampleOFTUpgradeable_init_unchained(_name, _symbol, _initialSupply, _lzEndpoint);
    }

    function __ExampleOFTUpgradeable_init_unchained(string memory, string memory, uint _initialSupply, address) internal onlyInitializing {
        _mint(_msgSender(), _initialSupply);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint[50] private __gap;
}
