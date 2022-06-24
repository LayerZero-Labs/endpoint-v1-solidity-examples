// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8;

import "../token/OFT20/OFT20Upgradeable.sol";

contract OFT20UpgradeableMock is OFT20Upgradeable {

    function initialize(string memory _name, string memory _symbol, uint _initialSupply, address _lzEndpoint) public initializer {
        __OFT20UpgradeableMock_init(_name, _symbol, _initialSupply, _lzEndpoint);
    }

    function __OFT20UpgradeableMock_init(string memory _name, string memory _symbol, uint _initialSupply, address _lzEndpoint) internal onlyInitializing {
        __Ownable_init();
        __OFT20Upgradeable_init(_name, _symbol, _lzEndpoint);
        __OFT20UpgradeableMock_init_unchained(_name, _symbol, _initialSupply, _lzEndpoint);
    }

    function __OFT20UpgradeableMock_init_unchained(string memory _name, string memory _symbol, uint _initialSupply, address _lzEndpoint) internal onlyInitializing {
        _mint(_msgSender(), _initialSupply);
    }

    function mint(address _account, uint256 _amount) external payable {
        _mint(_account, _amount);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
