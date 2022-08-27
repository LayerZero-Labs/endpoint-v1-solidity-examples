// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import "./IONFT721Core.sol";
import "../../lzApp/NonblockingLzApp.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

abstract contract ONFT721Core is NonblockingLzApp, ERC165, IONFT721Core {
    uint public constant NO_EXTRA_GAS = 0;
    uint8 public constant FUNCTION_TYPE_SEND = 1;
    bool public useCustomAdapterParams;

    event SetUseCustomAdapterParams(bool _useCustomAdapterParams);

    /// @notice Constructor for the ONFT721Core
    /// @param _lzEndpoint handles message transmission across chains
    constructor(address _lzEndpoint) NonblockingLzApp(_lzEndpoint) {}

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IONFT721Core).interfaceId || super.supportsInterface(interfaceId);
    }

    function estimateSendFee(uint16 _dstChainId, bytes memory _toAddress, uint _tokenId, bool _useZro, bytes memory _adapterParams) public view virtual override returns (uint nativeFee, uint zroFee) {
        bytes memory payload = abi.encode(_toAddress, _toSingletonArray(_tokenId));
        return lzEndpoint.estimateFees(_dstChainId, address(this), payload, _useZro, _adapterParams);
    }

    function estimateSendMultiFee(uint16 _dstChainId, bytes memory _toAddress, uint[] memory _tokenIdArray, bool _useZro) public view virtual override returns (uint nativeFee, uint zroFee) {
        bytes memory payload = abi.encode(_toAddress, _tokenIdArray);
        uint16 version = 1;
        uint destinationGas = 200000 + ((_tokenIdArray.length - 1) * 50000);
        bytes memory _adapterParams = abi.encodePacked(version, destinationGas);
        return lzEndpoint.estimateFees(_dstChainId, address(this), payload, _useZro, _adapterParams);
    }

    function sendFrom(address _from, uint16 _dstChainId, bytes memory _toAddress, uint _tokenId, address payable _refundAddress, address _zroPaymentAddress, bytes memory _adapterParams) public payable virtual override {
        _send(_from, _dstChainId, _toAddress, _toSingletonArray(_tokenId), _refundAddress, _zroPaymentAddress, _adapterParams);
    }

    function sendFrom(address _from, uint16 _dstChainId, bytes memory _toAddress, uint[] memory _tokenIdArray, address payable _refundAddress, address _zroPaymentAddress, bytes memory _adapterParams) public payable virtual override {
        _send(_from, _dstChainId, _toAddress, _tokenIdArray, _refundAddress, _zroPaymentAddress, _adapterParams);
    }

    function _send(address _from, uint16 _dstChainId, bytes memory _toAddress, uint[] memory _tokenIdArray, address payable _refundAddress, address _zroPaymentAddress, bytes memory _adapterParams) internal virtual {
        _debitFrom(_from, _dstChainId, _toAddress, _tokenIdArray);

        bytes memory payload = abi.encode(_toAddress, _tokenIdArray);

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
        (bytes memory toAddressBytes, uint[] memory _tokenIdArray) = abi.decode(_payload, (bytes, uint[]));
        address toAddress;
        assembly {
            toAddress := mload(add(toAddressBytes, 20))
        }

        _creditTo(_srcChainId, toAddress, _tokenIdArray);

        emit ReceiveFromChain(_srcChainId, _srcAddress, toAddress, _tokenIdArray);
    }

    function setUseCustomAdapterParams(bool _useCustomAdapterParams) external onlyOwner {
        useCustomAdapterParams = _useCustomAdapterParams;
        emit SetUseCustomAdapterParams(_useCustomAdapterParams);
    }

    function _toSingletonArray(uint element) internal pure returns (uint[] memory) {
        uint[] memory array = new uint[](1);
        array[0] = element;
        return array;
    }

    function _debitFrom(address _from, uint16 _dstChainId, bytes memory _toAddress, uint[] memory _tokenIdArray) internal virtual;

    function _creditTo(uint16 _srcChainId, address _toAddress, uint[] memory _tokenIdArray) internal virtual;
}
