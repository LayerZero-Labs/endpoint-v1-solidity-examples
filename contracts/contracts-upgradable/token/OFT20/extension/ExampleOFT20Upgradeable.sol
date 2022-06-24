// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../OFT20Upgradeable.sol";
import "hardhat-deploy/solc_0.8/proxy/Proxied.sol";

contract ExampleOFT20Upgradeable is Initializable, OFT20Upgradeable, Proxied {

    function initialize(string memory _name, string memory _symbol, address _lzEndpoint) public initializer {
        __ExampleOFT20Upgradeable_init(_name, _symbol, _lzEndpoint);
    }

    function __ExampleOFT20Upgradeable_init(string memory _name, string memory _symbol, address _lzEndpoint) internal onlyInitializing {
        __Ownable_init();
        __OFT20Upgradeable_init(_name, _symbol, _lzEndpoint);
    }

    function __ExampleOFT20Upgradeable_init_unchained(string memory _name, string memory _symbol, address _lzEndpoint) internal onlyInitializing {}

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
