// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.2;

import "hardhat-deploy/solc_0.8/proxy/Proxied.sol";
import "../token/onft/1155/ONFT1155Upgradable.sol";

contract ExampleONFT1155Upgradeable is Initializable, ONFT1155Upgradeable, Proxied {
    function initialize(string memory _uri, address _lzEndpoint, uint _amount) public initializer {
        __ExampleONFT1155Upgradeable_init(_uri, _lzEndpoint, _amount);
    }

    function __ExampleONFT1155Upgradeable_init(string memory _uri, address _lzEndpoint, uint _amount) internal onlyInitializing {
        __Ownable_init();
        __ONFT1155Upgradeable_init(_uri, _lzEndpoint);
        __ExampleONFT1155Upgradeable_init_unchained(_amount);
    }

    function __ExampleONFT1155Upgradeable_init_unchained(uint _amount) internal onlyInitializing {
        if(_amount > 0) {
            _mint(_msgSender(), 1, _amount, "");
        }
    }

    function mintBatch(address _to, uint256[] memory _ids, uint256[] memory _amounts) external payable {
        _mintBatch(_to, _ids, _amounts, "");
    }

    function mint(address _to, uint256 _id, uint256 _amount) external payable {
        _mint(_to, _id, _amount, "");
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint[50] private __gap;
}
