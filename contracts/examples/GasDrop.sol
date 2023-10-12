// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../lzApp/NonblockingLzApp.sol";

/// @title GasDrop
/// @notice A contract for sending and receiving gas across chains using LayerZero's NonblockingLzApp.
contract GasDrop is NonblockingLzApp {

    /// @notice The version of the adapterParams.
    uint16 public constant VERSION = 2;
    
    /// @notice The default amount of gas to be used on the destination chain.
    uint public dstGas = 25000;

    /// @dev Emitted when the destination gas is updated.
    event SetDstGas(uint dstGas);
    
    /// @dev Emitted when a gas drop is sent.
    event SendGasDrop(uint16 indexed _dstChainId, address indexed _from, bytes indexed _toAddress, uint _amount);
    
    /// @dev Emitted when a gas drop is received on this chain.
    event ReceiveGasDrop(uint16 indexed _srcChainId, address indexed _from, bytes indexed _toAddress, uint _amount);

    /// @param _endpoint The LayerZero endpoint address.
    constructor(address _endpoint) NonblockingLzApp(_endpoint) {}

    /// @dev Internal function to handle incoming LayerZero messages and emit a ReceiveGasDrop event.
    /// @param _srcChainId The source chain ID from where the message originated.
    /// @param _payload The payload of the incoming message.
    function _nonblockingLzReceive(uint16 _srcChainId, bytes memory, uint64, bytes memory _payload) internal virtual override {
        (uint amount, address fromAddress, bytes memory toAddress) = abi.decode(_payload, (uint, address, bytes));
        emit ReceiveGasDrop(_srcChainId, fromAddress, toAddress, amount);
    }

    /// @notice Estimate the fee for sending a gas drop to other chains.
    /// @param _dstChainId Array of destination chain IDs.
    /// @param _toAddress Array of destination addresses.
    /// @param _amount Array of amounts to send.
    /// @param _useZro Whether to use ZRO for payment or not.
    /// @return nativeFee The total native fee for all destinations.
    /// @return zroFee The total ZRO fee for all destinations.
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

    /// @notice Send gas drops to other chains.
    /// @param _dstChainId Array of destination chain IDs.
    /// @param _toAddress Array of destination addresses.
    /// @param _amount Array of amounts to send.
    /// @param _refundAddress Address for refunds.
    /// @param _zroPaymentAddress Address for ZRO payments.
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

    /// @notice Update the destination gas amount.
    /// @param _dstGas The new destination gas amount.
    function setDstGas(uint _dstGas) external onlyOwner {
        dstGas = _dstGas;
        emit SetDstGas(dstGas);
    }

    /// @dev Fallback function to receive Ether.
    receive() external payable {}
}
