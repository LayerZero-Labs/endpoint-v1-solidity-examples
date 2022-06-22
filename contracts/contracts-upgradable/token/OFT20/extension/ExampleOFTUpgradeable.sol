// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../OFT20Upgradeable.sol";

contract ExampleOFT20Upgradeable is Initializable, OFT20Upgradeable {

    function initialize(string memory _name, string memory _symbol, address _lzEndpoint) public initializer {
        __ExampleOFT20Upgradeable_init(_name, _symbol, _lzEndpoint);
    }

    function __ExampleOFT20Upgradeable_init(string memory _name, string memory _symbol, address _lzEndpoint) internal onlyInitializing {
        __Ownable_init();
        __OFT20Upgradeable_init(_name, _symbol, _lzEndpoint);
    }

    function __ExampleOFT20Upgradeable_init_unchained(string memory _name, string memory _symbol, address _lzEndpoint) internal onlyInitializing {}
}
