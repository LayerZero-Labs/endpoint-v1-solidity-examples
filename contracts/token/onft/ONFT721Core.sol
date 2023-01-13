// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IONFT721Core.sol";
import "../../lzApp/NonblockingLzApp.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

abstract contract ONFT721Core is NonblockingLzApp, ERC165, IONFT721Core {
    uint public constant NO_EXTRA_GAS = 0;
    uint16 public constant FUNCTION_TYPE_SEND = 1;
    uint16 public constant FUNCTION_TYPE_SEND_BATCH = 2;
    bool public useCustomAdapterParams;

    struct StoredCredit {
        uint16 srcChainId;
        address toAddress;
        uint256 index;
    }

    uint256 public minGasToTransferAndStore;
    mapping(uint16 => uint256) public dstChainIdToBatchLimit;
    mapping(uint16 => uint256) public dstChainIdToTransferGas;
    mapping(bytes32 => StoredCredit) public storedCredits;

    event SetUseCustomAdapterParams(bool _useCustomAdapterParams);

    constructor(uint256 _minGasToTransferAndStore, address _lzEndpoint) NonblockingLzApp(_lzEndpoint) {
        require(_minGasToTransferAndStore > 0, "ONFT721: minGasToTransferAndStore must be > 0");
        minGasToTransferAndStore = _minGasToTransferAndStore;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IONFT721Core).interfaceId || super.supportsInterface(interfaceId);
    }

    function estimateSendFee(uint16 _dstChainId, bytes memory _toAddress, uint _tokenId, bool _useZro, bytes memory _adapterParams) public view virtual override returns (uint nativeFee, uint zroFee) {
        return estimateSendBatchFee(_dstChainId, _toAddress, _toSingletonArray(_tokenId), _useZro, _adapterParams);
    }

    function estimateSendBatchFee(uint16 _dstChainId, bytes memory _toAddress, uint[] memory _tokenIds, bool _useZro, bytes memory _adapterParams) public view virtual override returns (uint nativeFee, uint zroFee) {
        bytes memory payload = abi.encode(_toAddress, _tokenIds);
        return lzEndpoint.estimateFees(_dstChainId, address(this), payload, _useZro, _adapterParams);
    }

    function sendFrom(address _from, uint16 _dstChainId, bytes memory _toAddress, uint _tokenId, address payable _refundAddress, address _zroPaymentAddress, bytes memory _adapterParams) public payable virtual override {
        _sendBatch(_from, _dstChainId, _toAddress, _toSingletonArray(_tokenId), _refundAddress, _zroPaymentAddress, _adapterParams);
    }

    function sendBatchFrom(address _from, uint16 _dstChainId, bytes memory _toAddress, uint[] memory _tokenIds, address payable _refundAddress, address _zroPaymentAddress, bytes memory _adapterParams) public payable virtual override {
        _sendBatch(_from, _dstChainId, _toAddress, _tokenIds, _refundAddress, _zroPaymentAddress, _adapterParams);
    }

    function _sendBatch(address _from, uint16 _dstChainId, bytes memory _toAddress, uint[] memory _tokenIds, address payable _refundAddress, address _zroPaymentAddress, bytes memory _adapterParams) internal virtual {
        require(_tokenIds.length <= dstChainIdToBatchLimit[_dstChainId], "ONFT721: batch size exceeds dst batch limit");

        for (uint i = 0; i < _tokenIds.length; i++) {
            _debitFrom(_from, _dstChainId, _toAddress, _tokenIds[i]);
        }

        bytes memory payload = abi.encode(_toAddress, _tokenIds);

        // TODO could be more efficient if we pass single id vs array of single _toSingletonArray?
        if (_tokenIds.length == 1) {
            if (useCustomAdapterParams) {
                _checkGasLimit(_dstChainId, FUNCTION_TYPE_SEND, _adapterParams, NO_EXTRA_GAS);
            } else {
                require(_adapterParams.length == 0, "LzApp: _adapterParams must be empty.");
            }
            _lzSend(_dstChainId, payload, _refundAddress, _zroPaymentAddress, _adapterParams, msg.value);
            emit SendToChain(_dstChainId, _from, _toAddress, _tokenIds[0]);
        } else if (_tokenIds.length > 1) {
            if (useCustomAdapterParams) {
                _checkGasLimit(_dstChainId, FUNCTION_TYPE_SEND_BATCH, _adapterParams, dstChainIdToTransferGas[_dstChainId] * _tokenIds.length);
            } else {
                require(_adapterParams.length == 0, "LzApp: _adapterParams must be empty.");
            }
            _lzSend(_dstChainId, payload, _refundAddress, _zroPaymentAddress, _adapterParams, msg.value);
            emit SendBatchToChain(_dstChainId, _from, _toAddress, _tokenIds);
        } else {
            revert("LzApp: tokenIds[] is empty");
        }
    }

    function _nonblockingLzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64, /*_nonce*/
        bytes memory _payload
    ) internal virtual override {
        // decode and load the toAddress
        (bytes memory toAddressBytes, uint[] memory tokenIds) = abi.decode(_payload, (bytes, uint[]));

        address toAddress;
        assembly {
            toAddress := mload(add(toAddressBytes, 20))
        }

        for (uint i = 0; i < tokenIds.length; i++) {
            if (gasleft() < minGasToTransferAndStore) {
                // not enough gas to transfer this index, so set it for the clearCredits() loop and store obj
                storedCredits[keccak256(abi.encode(_payload))] = StoredCredit(_srcChainId, toAddress, i);
                break;
            }
            _creditTo(_srcChainId, toAddress, tokenIds[i]);
        }

        if (tokenIds.length == 1) {
            emit ReceiveFromChain(_srcChainId, _srcAddress, toAddress, tokenIds[0]);
        } else if (tokenIds.length > 1) {
            emit ReceiveBatchFromChain(_srcChainId, _srcAddress, toAddress, tokenIds);
        }
    }

    function clearCredits(address _toAddress, uint[] memory _tokenIds) external {
        bytes32 hashedPayload = keccak256(abi.encode(_toAddress, _tokenIds));
        require(storedCredits[hashedPayload].toAddress != address(0x0), "invalid payload");

        uint i = storedCredits[hashedPayload].index;
        while(i < _tokenIds.length) {
            // if not enough gas to process, store this index for next loop
            if (gasleft() < minGasToTransferAndStore) break;

            _creditTo(storedCredits[hashedPayload].srcChainId, _toAddress, _tokenIds[i]);
            i++;
        }

        if (i >= _tokenIds.length) {
            // completed the credits, delete the element
            delete storedCredits[hashedPayload];
        } else {
            // store the next index to mint
            storedCredits[hashedPayload] = StoredCredit(storedCredits[hashedPayload].srcChainId, _toAddress, i);
        }
    }

    function setMinGasToTransferAndStore(uint256 _minGasToTransferAndStore) external onlyOwner {
        require(_minGasToTransferAndStore > 0, "ONFT721: minGasToTransferAndStore must be > 0");
        minGasToTransferAndStore = _minGasToTransferAndStore;
    }

    // ensures enough gas in adapter params to handle batch transfer gas amounts on the dst
    function setDstChainIdToTransferGas(uint16 _dstChainId, uint256 _dstChainIdToTransferGas) external onlyOwner {
        require(_dstChainIdToTransferGas > 0, "ONFT721: dstChainIdToTransferGas must be > 0");
        dstChainIdToTransferGas[_dstChainId] = _dstChainIdToTransferGas;
    }

    // limit on src the amount of tokens to batch send
    function setDstChainIdToBatchLimit(uint16 _dstChainId, uint256 _dstChainIdToBatchLimit) external onlyOwner {
        require(_dstChainIdToBatchLimit > 0, "ONFT721: dstChainIdToBatchLimit must be > 0");
        dstChainIdToBatchLimit[_dstChainId] = _dstChainIdToBatchLimit;
    }

    function setUseCustomAdapterParams(bool _useCustomAdapterParams) external onlyOwner {
        useCustomAdapterParams = _useCustomAdapterParams;
        emit SetUseCustomAdapterParams(_useCustomAdapterParams);
    }

    function _debitFrom(address _from, uint16 _dstChainId, bytes memory _toAddress, uint _tokenId) internal virtual;

    function _creditTo(uint16 _srcChainId, address _toAddress, uint _tokenId) internal virtual;

    function _toSingletonArray(uint element) internal pure returns (uint[] memory) {
        uint[] memory array = new uint[](1);
        array[0] = element;
        return array;
    }
}
