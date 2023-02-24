// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.2;

import "hardhat-deploy/solc_0.8/proxy/Proxied.sol";
import "../token/onft/721/ONFT721Upgradeable.sol";

contract ExampleONFT721Upgradeable is Initializable, ONFT721Upgradeable, Proxied {
    function initialize(string memory _name, string memory _symbol, uint256 _minGasToTransfer, address _lzEndpoint) public initializer {
        __ExampleONFT721Upgradeable_init(_name, _symbol, _minGasToTransfer, _lzEndpoint);
    }

    function __ExampleONFT721Upgradeable_init(string memory _name, string memory _symbol, uint256 _minGasToTransfer, address _lzEndpoint) internal onlyInitializing {
        __Ownable_init();
        __ONFT721Upgradeable_init(_name, _symbol, _minGasToTransfer, _lzEndpoint);
    }

    function __ExampleONFT721Upgradeable_init_unchained() internal onlyInitializing {}

    function mint(address _tokenOwner, uint _newId) external payable {
        _safeMint(_tokenOwner, _newId);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint[50] private __gap;
}
