// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @dev Interface of the OFT standard
 */
interface IOFT is IERC20 {
    /**
     * @dev send `_amount` amount of token to (`_dstChainId`, `_toAddress`)
     * `_toAddress` can be any size depending on the `dstChainId`.
     * `_zroPaymentAddress` set to address(0x0) if not paying in ZRO (LayerZero Token)
     * `_adapterParam` is a flexible bytes array to indicate messaging adapter services
     */
    function sendTokens(uint16 _dstChainId, bytes calldata _toAddress, uint256 _amount, address _zroPaymentAddress, bytes calldata _adapterParam) external payable;

    function sendTokensFrom(address _from, uint16 _dstChainId, bytes calldata _toAddress, uint256 _amount, address _zroPaymentAddress, bytes calldata _adapterParam) external payable;


    /**
     * @dev Emitted when `_amount` tokens are moved from the `_sender` to (`_dstChainId`, `_toAddress`)
     * `_nonce` is the outbound nonce from
     */
    event SendToChain(address indexed _sender, uint16 indexed _dstChainId, bytes indexed _toAddress, uint256 _amount, uint64 _nonce);
    event ReceiveFromChain(uint16 srcChainId, address toAddress, uint256 qty, uint64 nonce);
}
