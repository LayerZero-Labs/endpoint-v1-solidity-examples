// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../lzApp/NonblockingLzApp.sol";

contract GasDrop is NonblockingLzApp {
    uint16 public constant VERSION = 2;
    uint public dstGas = 25000;

    event SetDstGas(uint dstGas);
    event SendGasDrop(uint16 indexed _dstChainId, address indexed _from, bytes indexed _toAddress, uint _amount);
    event ReceiveGasDrop(uint16 indexed _srcChainId, address indexed _from, bytes indexed _toAddress, uint _amount);

    constructor(address _endpoint) NonblockingLzApp(_endpoint) {}

    function _nonblockingLzReceive(uint16 _srcChainId, bytes memory, uint64, bytes memory _payload) internal virtual override {
        (uint amount, address fromAddress, bytes memory toAddress) = abi.decode(_payload, (uint, address, bytes));
        emit ReceiveGasDrop(_srcChainId, fromAddress, toAddress, amount);
    }

    function estimateSendFee(uint16[] calldata _dstChainId, bytes[] calldata _toAddress, uint[] calldata _amount, bool _useZro) external view virtual returns (uint nativeFee, uint zroFee) {
        require(_dstChainId.length == _toAddress.length, "_dstChainId and _toAddress must be same size");
        require(_toAddress.length == _amount.length, "_toAddress and _amount must be same size");
        for(uint i = 0; i < _dstChainId.length; i++) {
            bytes memory adapterParams = abi.encodePacked(VERSION, dstGas, _amount[i], _toAddress[i]);
            bytes memory payload = abi.encode(_amount[i], msg.sender, _toAddress[i]);
            (uint native, uint zro) = lzEndpoint.estimateFees(_dstChainId[i], address(this), payload, _useZro, adapterParams);
            nativeFee += native;
            zroFee += zro;
        }
    }

    function gasDrop(uint16[] calldata _dstChainId, bytes[] calldata _toAddress, uint[] calldata _amount, address payable _refundAddress, address _zroPaymentAddress) external payable virtual {
        require(_dstChainId.length == _toAddress.length, "_dstChainId and _toAddress must be same size");
        require(_toAddress.length == _amount.length, "_toAddress and _amount must be same size");
        uint _dstGas = dstGas;
        for(uint i = 0; i < _dstChainId.length; i++) {
            bytes memory adapterParams = abi.encodePacked(VERSION, _dstGas, _amount[i], _toAddress[i]);
            bytes memory payload = abi.encode(_amount[i], msg.sender, _toAddress[i]);
            address payable refundAddress = (i == _dstChainId.length - 1) ? _refundAddress : payable(address(this));
            _lzSend(_dstChainId[i], payload, refundAddress, _zroPaymentAddress, adapterParams, address(this).balance);
            emit SendGasDrop(_dstChainId[i], msg.sender, _toAddress[i], _amount[i]);
        }
    }

    function setDstGas(uint _dstGas) external onlyOwner {
        dstGas = _dstGas;
        emit SetDstGas(dstGas);
    }

    receive() external payable {}
}