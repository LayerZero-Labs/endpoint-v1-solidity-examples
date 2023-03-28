// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.2;

import "hardhat-deploy/solc_0.8/proxy/Proxied.sol";
import "../token/onft/ERC1155/ONFT1155Upgradable.sol";

contract ExampleONFT1155Upgradeable is Initializable, ONFT1155Upgradeable, Proxied {
    function initialize(string memory _uri, address _lzEndpoint, uint _amount) public initializer {
        __ONFT1155Upgradeable_init(_uri, _lzEndpoint);
        if(_amount > 0) {
            _mint(_msgSender(), 1, _amount, "");
        }
    }

    function mintBatch(address _to, uint256[] memory _ids, uint256[] memory _amounts) external {
        _mintBatch(_to, _ids, _amounts, "");
    }

    function mint(address _to, uint256 _id, uint256 _amount) external {
        _mint(_to, _id, _amount, "");
    }
}
