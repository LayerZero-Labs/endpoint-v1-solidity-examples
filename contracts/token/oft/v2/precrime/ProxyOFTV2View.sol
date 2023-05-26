// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./OFTV2View.sol";
import "../ProxyOFTV2.sol";

contract ProxyOFTV2View is OFTV2View {
    constructor(address _oft) OFTV2View(_oft) {}

    function lzReceive(uint16 _srcChainId, bytes32 _scrAddress, bytes memory _payload, uint _totalSupply) external view virtual override returns (uint) {
        require(_isPacketFromTrustedRemote(_srcChainId, _scrAddress), "ProxyOFTV2View: not trusted remote");
        uint amount = _decodePayload(_payload);

        require(_totalSupply >= amount, "ProxyOFTV2View: transfer amount exceeds locked amount");
        return _totalSupply - amount;
    }

    function isProxy() external pure override returns (bool) {
        return true;
    }

    function getTotalSupply() external view override returns (uint) {
        return ProxyOFTV2(address(oft)).outboundAmount();
    }
}
