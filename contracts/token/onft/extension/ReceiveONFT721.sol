// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.9;

import "../ONFT721.sol";
import "../../../helpers/Queue.sol";
import "../DistributeCore.sol";

/// @title Interface of the ReceiveONFT721 standard
contract ReceiveONFT721 is DistributeCore {

    /// @notice Constructor for the DistributeONFT
    /// @param _name the name of the token
    /// @param _symbol the token symbol
    /// @param _lzEndpoint handles message transmission across chains
    constructor(string memory _name, string memory _symbol, address _lzEndpoint) DistributeCore(_name, _symbol, _lzEndpoint) {}

    function mint() external payable {
        require(tokenIdsLeft() > 0, "ONFT721: max mint limit reached");
        uint newId = tokenIdQueue.dequeue();
        _safeMint(msg.sender, newId);
    }
}