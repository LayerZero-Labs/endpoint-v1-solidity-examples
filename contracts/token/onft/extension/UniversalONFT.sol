// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8;

import ".././ONFT.sol";

/// @title Interface of the UniversalONFT standard
contract UniversalONFT is ONFT {

    uint256 startMintIndex;
    uint256 maxMint;

    /// @notice Constructor for the UniversalONFT
    /// @param _name the name of the token
    /// @param _symbol the token symbol
    /// @param _layerZeroEndpoint handles message transmission across chains
    /// @param _startMintIndex the starting mint number on this chain
    /// @param _maxMint the max number of mints on this chain
    constructor(
        string memory _name,
        string memory _symbol,
        address _layerZeroEndpoint,
        uint256 _startMintIndex,
        uint256 _maxMint
    ) ONFT(_name, _symbol, _layerZeroEndpoint) {
        startMintIndex = _startMintIndex;
        maxMint = _maxMint;
    }

    /// @notice Mint your ONFT
    function mint() external payable {
        require(startMintIndex + 1 <= maxMint, "ONFT: Max Mint limit reached");
        _safeMint(msg.sender, ++startMintIndex);
    }
}