// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../fee/ProxyOFTWithFee.sol";

contract AptosProxyOFTWithFee is ProxyOFTWithFee {
	constructor(address _token, uint8 _sharedDecimals, address _lzEndpoint) ProxyOFTWithFee(_token, _sharedDecimals, _lzEndpoint) {
	}

	/// Ensures the total is less than uint64.max in sd
	function _checkOutboundAmount() internal virtual override {
        uint cap = type(uint64).max * _ld2sdRate();
        require(cap >= outboundAmount, "AptosProxyOFTWithFee: outboundAmount overflow");
    }
}