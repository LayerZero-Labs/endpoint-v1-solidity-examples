// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0;

interface IOFTV2View {
	/// @notice simulates receiving of a message
	function lzReceive(uint16 _srcChainId, bytes32 _scrAddress, bytes memory _payload, uint _totalSupply) external view returns (uint);

	function getInboundNonce(uint16 _srcChainId, bytes32 _scrAddress) external view returns (uint64);

    /// @notice returns the total supply for OFTV2 or outbound amount for ProxyOFTV2
    function getTotalSupply() external view returns (uint);

    /// @notice indicates whether the view is OFTV2 or ProxyOFTV2
    function isProxy() external view returns (bool);
}
