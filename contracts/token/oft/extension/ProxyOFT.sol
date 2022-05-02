// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../OFTCore.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ProxyOFT is OFTCore {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;

    constructor(address _lzEndpoint, address _proxyToken) OFTCore(_lzEndpoint) {
        token = IERC20(_proxyToken);
    }

    function sendFrom(
        address, /* _from */
        uint16, /* _dstChainId */
        bytes calldata, /* _toAddress */
        uint, /* _amount */
        address payable, /* _refundAddress */
        address, /* _zroPaymentAddress */
        bytes calldata /* _adapterParams */
    ) public payable virtual override {
        revert("ProxyOFT: no implementer");
    }

    function _debitFrom(
        address _from,
        uint16, /*_dstChainId*/
        bytes memory, /*_toAddress*/
        uint _amount
    ) internal virtual override {
        token.safeTransferFrom(_from, address(this), _amount);
    }

    function _creditTo(
        uint16, /*_srcChainId*/
        address _toAddress,
        uint _amount
    ) internal virtual override {
        token.safeTransfer(_toAddress, _amount);
    }
}
