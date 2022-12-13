// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../fee/ProxyOFTWithFee.sol";

/**
 * @title  Proxy OFT with fee Aptos
 * @dev    Ensures the amount transferred doesn't exceed uint64.max and the number of shared decimals doesn't exceed 6
 * @notice Proxy OFT with fee used for bridging existing tokens to and from Aptos supporting additional bridging fees
 */
contract ProxyOFTWithFeeAptos is ProxyOFTWithFee {
    uint8 public constant APTOS_MAX_DECIMALS = 6;

    constructor(address _token, uint8 _sharedDecimals, address _lzEndpoint) ProxyOFTWithFee(_token, _sharedDecimals, _lzEndpoint) {
        require(_sharedDecimals <= APTOS_MAX_DECIMALS, "ProxyOFTWithFeeAptos: shared decimals exceed maximum allowed");
    }

    function _encodeSendPayload(bytes32 _toAddress, uint _amount) internal view override returns (bytes memory) {
        return abi.encode(PT_SEND, _toAddress, _ld2sd(_amount));
    }

    function _decodeSendPayload(bytes memory _payload) internal view override returns (address to, uint amount) {
        (, bytes32 toAddressBytes, uint64 amountSD) = abi.decode(_payload, (uint8, bytes32, uint64));

        to = _bytes32ToAddress(toAddressBytes);
        amount = amountSD * _ld2sdRate();
    }

    function _encodeSendAndCallPayload(address _from, bytes32 _toAddress, uint _amount, bytes memory _payload, uint64 _dstGasForCall) internal view override returns (bytes memory) {
        return abi.encode(PT_SEND_AND_CALL, _toAddress, _ld2sd(_amount), _addressToBytes32(_from), _dstGasForCall, _payload);
    }

    function _decodeSendAndCallPayload(bytes memory _payload) internal view override returns (bytes32 from, address to, uint amount, bytes memory payload, uint64 dstGasForCall) {
        bytes32 toAddressBytes;
        uint amountSD;
        (, toAddressBytes, amountSD, from, dstGasForCall, payload) = abi.decode(_payload, (uint8, bytes32, uint, bytes32, uint64, bytes));

        to = _bytes32ToAddress(toAddressBytes);
        amount = amountSD * _ld2sdRate();
    }
    
    /**
     * @notice converts amount in local decimals to the amount in shared decimals
     * @dev    ensures the amount in shared decimals doesn't exceed uint64.max
     * @param  _amount in local decimals
     * @return uint64  amount in shared decimals
     */
    function _ld2sd(uint _amount) private view returns (uint64) {
        uint amountSD = _amount / _ld2sdRate();
        // NOTE: this require will never fail as outboundAmount check is performed first. 
        // Kept for consistency with OFTV2Aptos and as a safeguard for future changes
        require(amountSD <= type(uint64).max, "ProxyOFTWithFeeAptos: amountSD overflow");
        return uint64(amountSD);
    }

    /**
     * @notice checks the outboundAmount
     * @dev    ensures the total outboundAmount doesn't exceed uint64.max
     */
    function _checkOutboundAmount() internal virtual override {
        uint cap = type(uint64).max * _ld2sdRate();
        require(cap >= outboundAmount, "ProxyOFTWithFeeAptos: outboundAmount overflow");
    }
}