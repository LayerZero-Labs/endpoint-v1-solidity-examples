// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "../ONFT721.sol";

/// @title Interface of the UniversalONFT standard
contract UniversalONFT721 is ONFT721 {
    uint public nextMintId;
    uint public maxMintId;

    /// @notice Constructor for the UniversalONFT
    /// @param _name the name of the token
    /// @param _symbol the token symbol
    /// @param _layerZeroEndpoint handles message transmission across chains
    /// @param _startMintId the starting mint number on this chain
    /// @param _endMintId the max number of mints on this chain
    constructor(string memory _name, string memory _symbol, uint256 _minGasToTransfer, address _layerZeroEndpoint, uint _startMintId, uint _endMintId) ONFT721(_name, _symbol, _minGasToTransfer, _layerZeroEndpoint) {
        nextMintId = _startMintId;
        maxMintId = _endMintId;
    }

    /// @notice Mint your ONFT
    function mint() external payable {
        require(nextMintId <= maxMintId, "UniversalONFT721: max mint limit reached");

        uint newId = nextMintId;
        nextMintId++;

        _safeMint(msg.sender, newId);
    }
}
