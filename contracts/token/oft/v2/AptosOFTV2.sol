// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./OFTV2.sol";

contract AptosOFTV2 is OFTV2 {
	uint8 public constant APTOS_DECIMALS = 6;

	constructor(string memory _name, string memory _symbol, address _lzEndpoint) OFTV2 (_name, _symbol, APTOS_DECIMALS, _lzEndpoint) {
	}

	function _ld2sd(uint _amount) private view returns (uint64) {
        uint amountSD = _amount / _ld2sdRate();
        require(amountSD <= type(uint64).max, "OFTCore: amountSD overflow");
        return uint64(amountSD);
    }

	function _encodeSendPayload(bytes32 _toAddress, uint _amount) internal override view returns (bytes memory) {
        return abi.encodePacked(PT_SEND, _toAddress, _ld2sd(_amount));
    }

	function _encodeSendAndCallPayload(address _from, bytes32 _toAddress, uint256 _amount, bytes memory _payload, uint64 _dstGasForCall) internal override view returns (bytes memory) {
        return abi.encodePacked(
            PT_SEND_AND_CALL,
            _toAddress,
            _ld2sd(_amount),
            _addressToBytes32(_from),
            _dstGasForCall,
            _payload
        );
    }
}