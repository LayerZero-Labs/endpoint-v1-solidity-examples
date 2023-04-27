// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "../ONFT721.sol";
import "../../../util/BitLib.sol";

/**
 DistributeONFT allows for contracts to distribute unused token ids to other chains. Default is set to 10,000 token ids
 w/ 2500 tokens on 4 chains. Uses uint[](40) to keep track of token ids on current chain. Each uint in the array uses
 250 bits of its allotted 256 bits to represent token ids. If the bit is set to 1 then that token id can be minted.
 Token Ids are defined by where they are in the tokenIds array.
 For example:
      [0]: 1-250,
      [1]: 251-500,
      [2]: 501-750,
      ... ,
      [40]: 9751-10000

Example using 8 bits to represent token distribution:

             Chain A | Chain B
tokenIds[0]: 0xff    | 0x0
tokenIds[1]: 0x0     | 0xff

Binary equivalent:

              Chain A   |  Chain B
tokenIds[0]: 1111 1111  | 0000 0000
tokenIds[1]: 0000 0000  | 1111 1111

In this scenario Chain A owns tokenIds: 1,2,3,4,5,6,7,8 and Chain B owns tokenIds: 9,10,11,12,13,14,15,16

Chain A wants to send over 2 Token Ids to Chain B

             Chain A | Chain B
tokenIds[0]: 0x3f    | 0xc0
tokenIds[1]: 0x0     | 0xff

Binary equivalent:

              Chain A   |  Chain B
tokenIds[0]: 0011 1111  | 1100 0000
tokenIds[1]: 0000 0000  | 1111 1111

Now Chain A owns tokenIds: 3,4,5,6,7,8 and Chain B owns tokenIds: 1,2,9,10,11,12,13,14,15,16
**/
contract DistributeONFT721 is ONFT721 {

    uint16 public constant FUNCTION_TYPE_DISTRIBUTE = 2;
    // Each uint in the array uses 250 bits of its allotted 256 bits to represent token ids.
    uint16 public constant NUM_TOKENS_PER_INDEX = 250;
    uint16 public constant MAX_TOKENS_PER_INDEX = 256;

    uint public distributeBaseDstGas = 50000;
    uint public distributeGasPerIdx = 25000;

    event Distribute(uint16 indexed _srcChainId, TokenDistribute[] tokenDistribute);
    event ReceiveDistribute(uint16 indexed _srcChainId, bytes indexed _srcAddress, TokenDistribute[] tokenDistribute);
    event SetDistributeBaseDstGas(uint _distributeBaseDstGas);
    event SetDistributeGasPerIdx(uint _distributeGasPerIdx);

    struct TokenDistribute {
        uint index;
        uint value;
    }

    uint[] public tokenIds = new uint[](40);

    /// @notice Constructor for the DistributeONFT721
    /// @param _name the name of the token
    /// @param _symbol the token symbol
    /// @param _layerZeroEndpoint handles message transmission across chains
    /// @param _indexArray to set to all ones representing token ids available to mint
    constructor(string memory _name, string memory _symbol, uint256 _minGasToTransfer, address _layerZeroEndpoint, uint[] memory _indexArray, uint[] memory _valueArray) ONFT721(_name, _symbol, _minGasToTransfer, _layerZeroEndpoint){
        uint _indexArrayLength = _indexArray.length;
        require(_indexArrayLength == _valueArray.length, "_indexArray and _valueArray must be same length");
        for(uint i; i < _indexArrayLength;) {
            tokenIds[_indexArray[i]] = _valueArray[i];
            unchecked{++i;}
        }
    }

    //---------------------------Public Functions----------------------------------------
    function estimateSendBatchFee(uint16 _dstChainId, bytes memory _toAddress, uint[] memory _tokenIds, bool _useZro, bytes memory _adapterParams) public view virtual override(IONFT721Core,ONFT721Core) returns (uint nativeFee, uint zroFee) {
        bytes memory payload = abi.encode(FUNCTION_TYPE_SEND, _toAddress, _tokenIds);
        return lzEndpoint.estimateFees(_dstChainId, address(this), payload, _useZro, _adapterParams);
    }

    function countAllSetBits() public view returns (uint count) {
        uint tokenIdsLength = tokenIds.length;
        for(uint i; i < tokenIdsLength;) {
            if(tokenIds[i] > 0) {
                count += BitLib.countSetBits(tokenIds[i]);
            }
            unchecked{++i;}
        }
        return count;
    }

    //---------------------------External Functions----------------------------------------

    function distributeTokens(uint16 _dstChainId, TokenDistribute[] memory _tokenDistribute, address payable _refundAddress, address _zroPaymentAddress) external payable onlyOwner {
        require(_verifyAmounts(_tokenDistribute), "Invalid input");
        _flipBits(_tokenDistribute);
        bytes memory payload = abi.encode(FUNCTION_TYPE_DISTRIBUTE, _tokenDistribute);
        bytes memory _adapterParams = _getMultiAdaptParams(_tokenDistribute.length);
        _lzSend(_dstChainId, payload, _refundAddress, _zroPaymentAddress, _adapterParams, msg.value);
        emit Distribute(_dstChainId, _tokenDistribute);
    }

    function getDistributeTokens(uint _amount) external view returns (TokenDistribute[] memory) {
        require(_amount > 0, "_amount must be > 0");
        uint tokenDistributeSize = _countTokenDistributeSize(_amount);

        require(tokenDistributeSize != 0, "Not enough tokens to distribute");

        uint amountNeeded = _amount;

        uint tokenIdsLength = tokenIds.length;

        TokenDistribute[] memory tokenDistributeFixed = new TokenDistribute[](tokenDistributeSize);
        uint index;
        for(uint i; i < tokenIdsLength;) {
            uint currentTokenId = tokenIds[i];
            if(currentTokenId == 0) {
                unchecked{++i;}
                continue;
            }
            if(amountNeeded == 0) break;
            uint sendValue;
            uint position;
            while(amountNeeded != 0) {
                position = BitLib.mostSignificantBitPosition(currentTokenId);
                uint temp = 1 << position;
                currentTokenId = currentTokenId ^ temp;
                sendValue = sendValue | temp;
                amountNeeded -= 1;
                if(currentTokenId == 0) break;
            }
            tokenDistributeFixed[index] = TokenDistribute(i, sendValue);
            unchecked{++i;++index;}
        }

        return tokenDistributeFixed;
    }

    function estimateDistributeFee(uint16 _dstChainId, TokenDistribute[] memory _tokenDistribute, bool _useZro) external view returns (uint nativeFee, uint zroFee) {
        return _estimatePayloadFee(_dstChainId, abi.encode(FUNCTION_TYPE_DISTRIBUTE, _tokenDistribute), _tokenDistribute.length, _useZro);
    }

    //---------------------------Internal Functions----------------------------------------

    // override _send in ONFT721Core to pass in FUNCTION_TYPE into payload
    function _send(address _from, uint16 _dstChainId, bytes memory _toAddress, uint[] memory _tokenIds, address payable _refundAddress, address _zroPaymentAddress, bytes memory _adapterParams) internal virtual override(ONFT721Core) {
        // allow 1 by default
        require(_tokenIds.length > 0, "tokenIds[] is empty");
        require(_tokenIds.length == 1 || _tokenIds.length <= dstChainIdToBatchLimit[_dstChainId], "batch size exceeds dst batch limit");

        for (uint i = 0; i < _tokenIds.length;) {
            _debitFrom(_from, _dstChainId, _toAddress, _tokenIds[i]);
            unchecked{++i;}
        }

        bytes memory payload = abi.encode(FUNCTION_TYPE_SEND, _toAddress, _tokenIds);

        _checkGasLimit(_dstChainId, FUNCTION_TYPE_SEND, _adapterParams, dstChainIdToTransferGas[_dstChainId] * _tokenIds.length);
        _lzSend(_dstChainId, payload, _refundAddress, _zroPaymentAddress, _adapterParams, msg.value);
        emit SendToChain(_dstChainId, _from, _toAddress, _tokenIds);
    }

    function _nonblockingLzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64, /*_nonce*/
        bytes memory _payload
    ) internal virtual override {
        uint8 functionType;
        assembly {
            functionType := mload(add(_payload, 32))
        }

        if(functionType == FUNCTION_TYPE_SEND) {
            // decode and load the toAddress
            (,bytes memory _toAddressBytes, uint[] memory _receivedTokenIds) = abi.decode(_payload, (uint16, bytes, uint[]));

            address toAddress;
            assembly {
                toAddress := mload(add(_toAddressBytes, 20))
            }

            uint nextIndex = _creditTill(_srcChainId, toAddress, 0, _receivedTokenIds);
            if (nextIndex < _receivedTokenIds.length) {
                // not enough gas to complete transfers, store to be cleared in another tx
                bytes32 hashedPayload = keccak256(_payload);
                storedCredits[hashedPayload] = StoredCredit(_srcChainId, toAddress, nextIndex, true);
                emit CreditStored(hashedPayload, _payload);
            }

            emit ReceiveFromChain(_srcChainId, _srcAddress, toAddress, _receivedTokenIds);
        } else if(functionType == FUNCTION_TYPE_DISTRIBUTE) {
            (, TokenDistribute[] memory tokenDistribute) = abi.decode(_payload, (uint16, TokenDistribute[]));
            uint tokenDistributeLength = tokenDistribute.length;
            for(uint i; i < tokenDistributeLength;) {
                uint temp = tokenIds[tokenDistribute[i].index];
                tokenIds[tokenDistribute[i].index] = temp | tokenDistribute[i].value;
                unchecked{++i;}
            }
            emit ReceiveDistribute(_srcChainId, _srcAddress, tokenDistribute);
        }
    }

    // Public function for anyone to clear and deliver the remaining batch sent tokenIds
    function clearCredits(bytes memory _payload) external virtual override {
        bytes32 hashedPayload = keccak256(_payload);
        require(storedCredits[hashedPayload].creditsRemain, "no credits stored");

        (,, uint[] memory _tokenIds) = abi.decode(_payload, (uint16, bytes, uint[]));

        uint nextIndex = _creditTill(storedCredits[hashedPayload].srcChainId, storedCredits[hashedPayload].toAddress, storedCredits[hashedPayload].index, _tokenIds);
        require(nextIndex > storedCredits[hashedPayload].index, "not enough gas to process credit transfer");

        if (nextIndex == _tokenIds.length) {
            // cleared the credits, delete the element
            delete storedCredits[hashedPayload];
            emit CreditCleared(hashedPayload);
        } else {
            // store the next index to mint
            storedCredits[hashedPayload] = StoredCredit(storedCredits[hashedPayload].srcChainId, storedCredits[hashedPayload].toAddress, nextIndex, true);
        }
    }

    function _verifyAmounts(TokenDistribute[] memory _tokenDistribute) internal view returns (bool) {
        uint tokenDistributeLength = _tokenDistribute.length;
        for(uint i; i < tokenDistributeLength;) {
            uint tempTokenIds = tokenIds[_tokenDistribute[i].index];
            uint result = tempTokenIds & _tokenDistribute[i].value;
            if(result != _tokenDistribute[i].value) return false;
            unchecked{++i;}
        }
        return true;
    }

    function _flipBits(TokenDistribute[] memory _tokenDistribute) internal {
        uint tokenDistributeLength = _tokenDistribute.length;
        for(uint i; i < tokenDistributeLength;) {
            tokenIds[_tokenDistribute[i].index] = tokenIds[_tokenDistribute[i].index] ^ _tokenDistribute[i].value;
            unchecked{++i;}
        }
    }

    function _estimatePayloadFee(uint16 _dstChainId, bytes memory _payload, uint _amount, bool _useZro) internal view returns (uint nativeFee, uint zroFee) {
        return lzEndpoint.estimateFees(_dstChainId, address(this), _payload, _useZro, _getMultiAdaptParams(_amount));
    }

    function _countTokenDistributeSize(uint _amount) internal view returns (uint) {
        uint totalCount;
        uint size;
        uint tokenIdsLength = tokenIds.length;
        for(uint i; i < tokenIdsLength;) {
            uint currentTokenId = tokenIds[i];
            uint count = BitLib.countSetBits(currentTokenId);
            if(count > 0) size += 1;
            totalCount += count;
            if(totalCount >= _amount) return size;
            unchecked{++i;}
        }
        return 0;
    }

    function _getMultiAdaptParams(uint _amount) internal view returns (bytes memory) {
        require(_amount > 0, "Amount must be greater than 0");
        uint16 version = 1;
        uint destinationGas = distributeBaseDstGas + ((_amount - 1) * distributeGasPerIdx);
        return abi.encodePacked(version, destinationGas);
    }

    function _getNextMintTokenIdAndClearFlag() internal returns (uint tokenId) {
        uint tokenIdsLength = tokenIds.length;
        for(uint i; i < tokenIdsLength;) {
            uint currentTokenId = tokenIds[i];
            if(currentTokenId == 0) {
                unchecked{++i;}
                continue;
            }
            uint position = BitLib.mostSignificantBitPosition(currentTokenId);
            uint temp = 1 << position;
            tokenIds[i] = tokenIds[i] ^ temp;
            tokenId = (MAX_TOKENS_PER_INDEX - position) + (i * NUM_TOKENS_PER_INDEX);
            break;
        }
        return tokenId;
    }

    function setDistributeBaseDstGas(uint _distributeBaseDstGas) external onlyOwner {
        distributeBaseDstGas = _distributeBaseDstGas;
        emit SetDistributeBaseDstGas(distributeBaseDstGas);
    }

    function setDistributeGasPerIdx(uint _distributeGasPerIdx) external onlyOwner {
        distributeGasPerIdx = _distributeGasPerIdx;
        emit SetDistributeGasPerIdx(distributeGasPerIdx);
    }
}