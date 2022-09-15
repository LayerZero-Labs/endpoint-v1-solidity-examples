// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "./ONFT721.sol";

// NOTE: this ONFT contract has no public minting logic.
// must implement your own minting logic in child classes
contract ONFT721Mint is ONFT721 {

    bool mintActive = true;
    address mintAddress;
    IERC721 public immutable erc721Contract;

    constructor(string memory _name, string memory _symbol, address _lzEndpoint, address erc721ContractAddress) ONFT721(_name, _symbol, _lzEndpoint) {
        erc721Contract = IERC721(erc721ContractAddress);
    }

    function mint() external {
        require(mintActive == true, "ONFT: Max Mint limit reached.");
        require(msg.sender == mintAddress, "ONFT: Non eligible address.");
        require(erc721Contract.balanceOf(msg.sender) > 0, "ONFT: User must own specific NFT721 to mint.");
        _safeMint(msg.sender, 1);
        mintActive = false;
    }

    function setEligibleMintAddress(address _mintAddress) external onlyOwner {
        mintAddress = _mintAddress;
    }
}
