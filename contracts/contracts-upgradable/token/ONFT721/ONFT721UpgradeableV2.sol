// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/IERC165Upgradeable.sol";
import "./ONFT721CoreUpgradeableV2.sol";
import "./IONFT721Upgradeable.sol";

// NOTE: this ONFT contract has no public minting logic.
// must implement your own minting logic in child classes
contract ONFT721UpgradeableV2 is ONFT721CoreUpgradeableV2, ERC721Upgradeable, IONFT721Upgradeable {

    function initializeONFT721Upgradeable(string memory _name, string memory _symbol, address _lzEndpoint) public initializer {
        ERC721Upgradeable.__ERC721_init(_name, _symbol);
        ONFT721CoreUpgradeableV2.initializeONFT721CoreUpgradeable(_lzEndpoint);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ONFT721CoreUpgradeableV2, ERC721Upgradeable, IERC165Upgradeable) returns (bool) {
        return interfaceId == type(IONFT721Upgradeable).interfaceId || super.supportsInterface(interfaceId);
    }

    function _debitFrom(address _from, uint16, bytes memory, uint _tokenId) internal virtual override {
        require(_isApprovedOrOwner(_msgSender(), _tokenId), "ONFT721: send caller is not owner nor approved");
        require(ERC721Upgradeable.ownerOf(_tokenId) == _from, "ONFT721: send from incorrect owner");
        _burn(_tokenId);
    }

    function _creditTo(uint16, address _toAddress, uint _tokenId) internal virtual override {
        _safeMint(_toAddress, _tokenId);
    }
}
