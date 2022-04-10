// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../lzApp/NonblockingLzApp.sol";
import "./IOFT.sol";

contract OFT is NonblockingLzApp, IOFT, ERC20 {
    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        uint256 _initialSupply
    ) ERC20(_name, _symbol) NonblockingLzApp(_lzEndpoint) {
        _mint(_msgSender(), _initialSupply);
    }

    function _nonblockingLzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64 _nonce,
        bytes memory _payload
    ) internal virtual override {
        _beforeReceiveTokens(_srcChainId, _srcAddress, _payload);

        // decode and load the toAddress
        (bytes memory toAddress, uint256 amount) = abi.decode(_payload, (bytes, uint256));
        address localToAddress;
        assembly {
            toAddress := mload(add(toAddress, 20))
        }
        // if the toAddress is 0x0, burn it or it will get cached
        if (localToAddress == address(0x0)) localToAddress == address(0xdEaD);

        _afterReceiveTokens(_srcChainId, localToAddress, amount);

        emit ReceiveFromChain(_srcChainId, localToAddress, amount, _nonce);
    }

    // todo: should we default the msg.sender to the refund address
    function sendTokens(
        uint16 _dstChainId,
        bytes calldata _toAddress,
        uint256 _amount,
        address _zroPaymentAddress,
        bytes calldata _adapterParam
    ) external payable override {
        _sendTokens(_msgSender(), _dstChainId, _toAddress, _amount, payable(msg.sender), _zroPaymentAddress, _adapterParam);
    }

    function sendTokensFrom(
        address _from,
        uint16 _dstChainId,
        bytes calldata _toAddress,
        uint256 _amount,
        address payable _refundAddress,
        address _zroPaymentAddress,
        bytes calldata _adapterParam
    ) external payable virtual override {
        address spender = _msgSender();
        _spendAllowance(_from, spender, _amount);
        _sendTokens(_from, _dstChainId, _toAddress, _amount, _refundAddress, _zroPaymentAddress, _adapterParam);
    }

    function _sendTokens(
        address _from,
        uint16 _dstChainId,
        bytes memory _toAddress,
        uint256 _amount,
        address payable _refundAddress,
        address _zroPaymentAddress,
        bytes calldata _adapterParam
    ) internal virtual {
        _beforeSendTokens(_from, _dstChainId, _toAddress, _amount);

        bytes memory payload = abi.encode(_toAddress, _amount);
        _lzSend(_dstChainId, payload, _refundAddress, _zroPaymentAddress, _adapterParam);

        _afterSendTokens(_from, _dstChainId, _toAddress, _amount);
    }

    function _beforeSendTokens(
        address _from,
        uint16 _dstChainId,
        bytes memory _toAddress,
        uint256 _amount
    ) internal virtual {
        _burn(_from, _amount);
    }

    function _afterSendTokens(
        address _from,
        uint16 _dstChainId,
        bytes memory _toAddress,
        uint256 _amount
    ) internal virtual {
        uint64 nonce = lzEndpoint.getOutboundNonce(_dstChainId, address(this));
        emit SendToChain(_from, _dstChainId, _toAddress, _amount, nonce);
    }

    function _beforeReceiveTokens(
        uint16 _dstChainId,
        bytes memory _srcAddress,
        bytes memory _payload
    ) internal virtual {}

    function _afterReceiveTokens(
        uint16 _dstChainId,
        address _toAddress,
        uint256 _amount
    ) internal virtual {
        _mint(_toAddress, _amount);
    }
}
