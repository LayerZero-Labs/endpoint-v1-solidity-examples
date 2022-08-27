// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.9;

import "../ONFT721.sol";
import "../../../helpers/Queue.sol";
import "../DistributeCore.sol";

/// @title Interface of the DistributeONFT standard
contract DistributeONFT721 is DistributeCore {

    event DistributeToChain(uint16 indexed _dstChainId, uint tokenRangeStart, uint tokenRangeEnd);

    uint public globalNextTokenId = 0;

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

    function estimateDistributeFee(uint16 _dstChainId, uint _amount, bool _useZro) external view onlyOwner returns (uint nativeFee, uint zroFee) {
        return _estimatePayloadFee(_dstChainId, abi.encode(FUNCTION_TYPE_DISTRIBUTE, globalNextTokenId, globalNextTokenId + _amount), _amount, _useZro);
    }

    function distribute(uint16 _dstChainId, uint _amount, address payable _refundAddress, address _zroPaymentAddress, bytes memory _adapterParams) external payable onlyOwner {
        require(_amount > 0, "DistributeONFT: amount must be greater than zero.");

        if(_dstChainId == lzEndpoint.getChainId()) {
            uint lastIndex = globalNextTokenId;
            for(uint startRange = lastIndex; startRange < lastIndex + _amount; startRange++) {
                tokenIdQueue.enqueue(startRange);
            }
        } else {
            bytes memory payload = abi.encode(FUNCTION_TYPE_DISTRIBUTE, globalNextTokenId, globalNextTokenId + _amount);
            uint8 funcType;
            assembly {
                funcType := mload(add(payload, 32))
            }

            if (useCustomAdapterParams) {
                _checkGasLimit(_dstChainId, FUNCTION_TYPE_DISTRIBUTE, _adapterParams, NO_EXTRA_GAS);
            } else {
                require(_adapterParams.length == 0, "LzApp: _adapterParams must be empty.");
            }
            _lzSend(_dstChainId, payload, _refundAddress, _zroPaymentAddress, _adapterParams);
        }

        emit DistributeToChain(_dstChainId, globalNextTokenId, globalNextTokenId + _amount);
        globalNextTokenId = globalNextTokenId + _amount;
    }
}