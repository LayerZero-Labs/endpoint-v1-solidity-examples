// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../ProxyOFTV2.sol";

contract AptosProxyOFTV2 is ProxyOFTV2 {
	constructor(address _token, uint8 _sharedDecimals, address _lzEndpoint) ProxyOFTV2(_token, _sharedDecimals, _lzEndpoint) {
	}

	/// Ensures the total is less than uint64.max in sd
	function _checkOutboundAmount() internal virtual override {
        uint cap = type(uint64).max * _ld2sdRate();
        require(cap >= outboundAmount, "AptosProxyOFTV2: outboundAmount overflow");
    }
}