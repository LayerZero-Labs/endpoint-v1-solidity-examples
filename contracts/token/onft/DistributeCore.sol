// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.9;

import "../../helpers/Queue.sol";
import "../../lzApp/NonblockingLzApp.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract DistributeCore is NonblockingLzApp, ERC721 {
    uint public constant NO_EXTRA_GAS = 0;
    uint8 public constant FUNCTION_TYPE_SEND = 1;
    uint8 public constant FUNCTION_TYPE_DISTRIBUTE = 2;
    uint8 public constant FUNCTION_TYPE_REDISTRIBUTE = 3;

    event SetUseCustomAdapterParams(bool _useCustomAdapterParams);
    event SendToChain(uint16 indexed _dstChainId, address indexed _from, bytes indexed _toAddress, uint[] _tokenIdArray);
    event RedistributeToChain(uint16 indexed _dstChainId, uint[] _tokenIdArray);
    event ReceiveFromChain(uint16 indexed _srcChainId, bytes indexed _srcAddress, address indexed _toAddress, uint[] _tokenIdArray);
    event ReceiveDistribute(uint16 indexed _srcChainId, bytes indexed _srcAddress, uint startTokenId, uint endTokenId);
    event ReceiveRedistribute(uint16 indexed _srcChainId, bytes indexed _srcAddress, uint[] _tokenIdArray);

    bool public useCustomAdapterParams;
    Queue public tokenIdQueue;

    /// @notice Constructor for the DistributeONFT
    /// @param _name the name of the token
    /// @param _symbol the token symbol
    /// @param _lzEndpoint handles message transmission across chains
    constructor(string memory _name, string memory _symbol, address _lzEndpoint) ERC721(_name, _symbol) NonblockingLzApp(_lzEndpoint) {
        tokenIdQueue = new Queue();
    }

    function tokenIdsLeft() public view returns (uint) {
        if(tokenIdQueue.last() >= tokenIdQueue.first()) {
            return tokenIdQueue.last() - tokenIdQueue.first() + 1;
        }
        return 0;
    }

    function getTokenIdsLeft() external view returns (uint[] memory) {
        uint firstIndex = tokenIdQueue.first();
        uint lastIndex = tokenIdQueue.last();
        uint numTokenIds = tokenIdsLeft();
        uint[] memory tokenArray = new uint[](numTokenIds);
        uint counter = 0;
        for(uint startRange = firstIndex; startRange <= lastIndex; startRange++) {
            tokenArray[counter] = tokenIdQueue.queue(startRange);
            counter++;
        }
        return tokenArray;
    }

    function estimateSendFee(uint16 _dstChainId, bytes memory _toAddress, uint _tokenId, bool _useZro, bytes memory _adapterParams) external view returns (uint nativeFee, uint zroFee) {
        bytes memory payload = abi.encode(FUNCTION_TYPE_SEND, _toAddress, _toSingletonArray(_tokenId));
        return lzEndpoint.estimateFees(_dstChainId, address(this), payload, _useZro, _adapterParams);
    }

    function estimateSendMultiFee(uint16 _dstChainId, bytes memory _toAddress, uint[] memory _tokenIdArray, bool _useZro) external view returns (uint nativeFee, uint zroFee) {
        return _estimatePayloadFee(_dstChainId, abi.encode(FUNCTION_TYPE_SEND, _toAddress, _tokenIdArray), _tokenIdArray.length, _useZro);
    }

    function estimateRedistributeFee(uint16 _dstChainId, uint[] memory _tokenIdArray, bool _useZro) external view onlyOwner returns (uint nativeFee, uint zroFee) {
        return _estimatePayloadFee(_dstChainId, abi.encode(FUNCTION_TYPE_REDISTRIBUTE, _tokenIdArray), _tokenIdArray.length, _useZro);
    }

    function setUseCustomAdapterParams(bool _useCustomAdapterParams) external onlyOwner {
        useCustomAdapterParams = _useCustomAdapterParams;
        emit SetUseCustomAdapterParams(_useCustomAdapterParams);
    }

    function redistribute(uint16 _dstChainId, uint _amount, address payable _refundAddress, address _zroPaymentAddress, bytes memory _adapterParams) external payable onlyOwner {
        require(_amount <= tokenIdsLeft(), "DistributeONFT: amount must be greater than the current amount left.");
        require(_dstChainId != lzEndpoint.getChainId(), "DistributeONFT: Cannot redistribute to own chain.");

        //send an array of token ids to other chains. need to be able ot unpack and add to there chain
        uint firstIndex = tokenIdQueue.first();
        uint lastIndex = firstIndex + _amount;

        uint[] memory tokenArray = new uint[](_amount);
        uint counter = 0;
        for(uint startRange = firstIndex; startRange < lastIndex; startRange++) {
            tokenArray[counter] = tokenIdQueue.dequeue();
            counter++;
        }

        bytes memory payload = abi.encode(FUNCTION_TYPE_REDISTRIBUTE, tokenArray);

        if (useCustomAdapterParams) {
            _checkGasLimit(_dstChainId, FUNCTION_TYPE_REDISTRIBUTE, _adapterParams, NO_EXTRA_GAS);
        } else {
            require(_adapterParams.length == 0, "LzApp: _adapterParams must be empty.");
        }
        _lzSend(_dstChainId, payload, _refundAddress, _zroPaymentAddress, _adapterParams);

        emit RedistributeToChain(_dstChainId, tokenArray);
    }

    function sendFrom(address _from, uint16 _dstChainId, bytes memory _toAddress, uint _tokenId, address payable _refundAddress, address _zroPaymentAddress, bytes memory _adapterParams) public payable {
        _send(_from, _dstChainId, _toAddress, _toSingletonArray(_tokenId), _refundAddress, _zroPaymentAddress, _adapterParams);
    }

    function sendFrom(address _from, uint16 _dstChainId, bytes memory _toAddress, uint[] memory _tokenIdArray, address payable _refundAddress, address _zroPaymentAddress, bytes memory _adapterParams) public payable {
        _send(_from, _dstChainId, _toAddress, _tokenIdArray, _refundAddress, _zroPaymentAddress, _adapterParams);
    }

    function _estimatePayloadFee(uint16 _dstChainId, bytes memory _payload, uint _amount, bool _useZro) internal view returns (uint nativeFee, uint zroFee) {
        uint16 version = 1;
        uint destinationGas = 200000 + ((_amount - 1) * 50000);
        bytes memory _adapterParams = abi.encodePacked(version, destinationGas);
        return lzEndpoint.estimateFees(_dstChainId, address(this), _payload, _useZro, _adapterParams);
    }

    function _toSingletonArray(uint element) internal pure returns (uint[] memory) {
        uint[] memory array = new uint[](1);
        array[0] = element;
        return array;
    }

    function _debitFrom(address _from, uint16, bytes memory, uint[] memory _tokenIdArray) internal {
        for (uint i = 0; i < _tokenIdArray.length; i++) {
            require(_isApprovedOrOwner(_msgSender(), _tokenIdArray[i]), "ONFT721: send caller is not owner nor approved");
            require(ERC721.ownerOf(_tokenIdArray[i]) == _from, "ONFT721: send from incorrect owner");
            _transfer(_from, address(this), _tokenIdArray[i]);
        }
    }

    function _creditTo(uint16, address _toAddress, uint[] memory _tokenIdArray) internal {
        for (uint i = 0; i < _tokenIdArray.length; i++) {
            require(!_exists(_tokenIdArray[i]) || (_exists(_tokenIdArray[i]) && ERC721.ownerOf(_tokenIdArray[i]) == address(this)));
            if (!_exists(_tokenIdArray[i])) {
                _safeMint(_toAddress, _tokenIdArray[i]);
            } else {
                _transfer(address(this), _toAddress, _tokenIdArray[i]);
            }
        }
    }

    function _send(address _from, uint16 _dstChainId, bytes memory _toAddress, uint[] memory _tokenIdArray, address payable _refundAddress, address _zroPaymentAddress, bytes memory _adapterParams) internal virtual {
        _debitFrom(_from, _dstChainId, _toAddress, _tokenIdArray);

        bytes memory payload = abi.encode(FUNCTION_TYPE_SEND, _toAddress, _tokenIdArray);

        if (useCustomAdapterParams) {
            _checkGasLimit(_dstChainId, FUNCTION_TYPE_SEND, _adapterParams, NO_EXTRA_GAS);
        } else {
            require(_adapterParams.length == 0, "LzApp: _adapterParams must be empty.");
        }
        _lzSend(_dstChainId, payload, _refundAddress, _zroPaymentAddress, _adapterParams);

        emit SendToChain(_dstChainId, _from, _toAddress, _tokenIdArray);
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
            (, bytes memory toAddressBytes, uint[] memory _tokenIdArray) = abi.decode(_payload, (uint8, bytes, uint[]));
            address toAddress;
            assembly {
                toAddress := mload(add(toAddressBytes, 20))
            }
            _creditTo(_srcChainId, toAddress, _tokenIdArray);
            emit ReceiveFromChain(_srcChainId, _srcAddress, toAddress, _tokenIdArray);
        } else if(functionType == FUNCTION_TYPE_DISTRIBUTE) {
            (, uint startTokenId, uint endTokenId) = abi.decode(_payload, (uint8, uint, uint));
            uint lastIndex = tokenIdQueue.last();
            uint amount = endTokenId - startTokenId;
            for(uint startRange = lastIndex; startRange < lastIndex + amount; startRange++) {
                tokenIdQueue.enqueue(startTokenId);
                startTokenId++;
            }
            emit ReceiveDistribute(_srcChainId, _srcAddress, startTokenId, endTokenId);
        } else if(functionType == FUNCTION_TYPE_REDISTRIBUTE) {
            (, uint[] memory _tokenIdArray) = abi.decode(_payload, (uint8, uint[]));
            uint amount = _tokenIdArray.length;
            for(uint startRange = 0; startRange < amount; startRange++) {
                tokenIdQueue.enqueue(_tokenIdArray[startRange]);
            }
            emit ReceiveRedistribute(_srcChainId, _srcAddress, _tokenIdArray);
        }
    }
}