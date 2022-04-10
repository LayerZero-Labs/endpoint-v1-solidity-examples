pragma solidity ^0.8.0;

import "../OFT.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract PausableOFT is OFT, Pausable {
    constructor (
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        uint16 _mainChainId,
        uint256 _initialSupply) OFT(_name, _symbol, _lzEndpoint, _mainChainId, _initialSupply){
    }

    function _beforeSendingTokens(
        address _from,
        uint16 _dstChainId,
        bytes memory _toAddress,
        uint256 _amount
    ) internal override whenNotPaused {}

    function pauseSendTokens(bool pause) external onlyOwner {
        pause? _pause() : _unpause();
    }
}
