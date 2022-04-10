// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../lzApp/NonblockingLzApp.sol";
import "./IOFT.sol";

/*
 * the default OFT implementation has a main chain where the total token supply is the source to total supply among all chains
 */
contract OFT is NonblockingLzApp, IOFT, ERC20 {
    bool public isMain;

    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        uint16 _mainChainId,
        uint256 _initialSupplyOnMainEndpoint
    ) ERC20(_name, _symbol) NonblockingLzApp(_lzEndpoint){
        // only mint the total supply on the main chain
        if (ILayerZeroEndpoint(_lzEndpoint).getChainId() == _mainChainId) {
            _mint(_msgSender(), _initialSupplyOnMainEndpoint);
            isMain = true;
        }
    }

    function _nonblockingLzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64 _nonce,
        bytes memory _payload
    ) internal override {
        // decode and load the toAddress
        (bytes memory toAddress, uint256 amount) = abi.decode(_payload, (bytes, uint256));
        address localToAddress;
        assembly {
            toAddress := mload(add(toAddress, 20))
        }
        // if the toAddress is 0x0, burn it or it will get cached
        if (localToAddress == address(0x0)) localToAddress == address(0xdEaD);

        // on the main chain unlock via transfer, otherwise _mint
        if (isMain) {
            _transfer(address(this), localToAddress, amount);
        } else {
            _mint(localToAddress, amount);
        }

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
        _beforeSendingTokens(_from, _dstChainId, _toAddress, _amount);

        if (isMain) {
            // lock by transferring to this contract if leaving the main chain,
            _transfer(_from, address(this), _amount);
        } else {
            // burn if leaving non-main chain
            _burn(_from, _amount);
        }

        bytes memory payload = abi.encode(_toAddress, _amount);

        _lzSend(_dstChainId, payload, _refundAddress, _zroPaymentAddress, _adapterParam);
        // send LayerZero message
        uint64 nonce = lzEndpoint.getOutboundNonce(_dstChainId, address(this));

        _beforeSendingTokens(_from, _dstChainId, _toAddress, _amount);

        emit SendToChain(_from, _dstChainId, _toAddress, _amount, nonce);
    }

    function _beforeSendingTokens(
        address _from,
        uint16 _dstChainId,
        bytes memory _toAddress,
        uint256 _amount
    ) internal virtual {}

    function _afterSendingTokens(
        address _from,
        uint16 _dstChainId,
        bytes memory _toAddress,
        uint256 _amount
    ) internal virtual {}
}
