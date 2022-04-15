// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

/**
 * @dev Interface of the ONFT standard
 */
interface IONFT1155 is IERC1155 {
    /**
     * @dev send token `_tokenId` to (`_dstChainId`, `_toAddress`)
     * `_toAddress` can be any size depending on the `dstChainId`.
     * `_zroPaymentAddress` set to address(0x0) if not paying in ZRO (LayerZero Token)
     * `_adapterParam` is a flexible bytes array to indicate messaging adapter services
     */
    function send(uint16 _dstChainId, bytes calldata _toAddress, uint _tokenId, uint amount, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParam) external payable;
    function sendBatch(uint16 _dstChainId, bytes calldata _toAddress, uint[] memory _tokenIds, uint[] memory amounts, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParam) external payable;

    /**
     * @dev send token `_tokenId` to (`_dstChainId`, `_toAddress`) from `_from`
     * `_toAddress` can be any size depending on the `dstChainId`.
     * `_zroPaymentAddress` set to address(0x0) if not paying in ZRO (LayerZero Token)
     * `_adapterParam` is a flexible bytes array to indicate messaging adapter services
     */
    function sendFrom(address _from, uint16 _dstChainId, bytes calldata _toAddress, uint _tokenId, uint _amount, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParam) external payable;
    function sendBatchFrom(address _from, uint16 _dstChainId, bytes calldata _toAddress, uint[] memory _tokenIds, uint[] memory _amounts, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParam) external payable;

    /**
     * @dev Emitted when `_tokenId` are moved from the `_sender` to (`_dstChainId`, `_toAddress`)
     * `_nonce` is the outbound nonce from
     */
    event SendToChain(address indexed _sender, uint16 indexed _dstChainId, bytes indexed _toAddress, uint _tokenId, uint _amount, uint64 _nonce);
    event SendBatchToChain(address indexed _sender, uint16 indexed _dstChainId, bytes indexed _toAddress, uint[] _tokenIds, uint[] _amounts, uint64 _nonce);

    /**
     * @dev Emitted when `_tokenId` are sent from `_srcChainId` to the `_toAddress` at this chain. `_nonce` is the inbound nonce.
     */
    event ReceiveFromChain(uint16 _srcChainId, address _toAddress, uint _tokenId, uint _amount, uint64 _nonce);
    event ReceiveBatchFromChain(uint16 _srcChainId, address _toAddress, uint[] _tokenIds, uint[] _amounts, uint64 _nonce);
}
