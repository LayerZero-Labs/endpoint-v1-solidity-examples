// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IOFT.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/ILayerZeroEndpoint.sol";
import "../receiver/NonBlockingLzReceiver.sol";

/*
 * the default OFT implementation has a main chain where the total token supply is the source to total supply among all chains
 */
contract OFT is NonblockingLzReceiver, IOFT, ERC20 {
    bool public isMain;

    constructor(
        string memory _name,
        string memory _symbol,
        address _endpoint,
        uint16 _mainChainId,
        uint256 _initialSupplyOnMainEndpoint
    ) ERC20(_name, _symbol) {
        // only mint the total supply on the main chain
        if (ILayerZeroEndpoint(_endpoint).getChainId() == _mainChainId) {
            _mint(_msgSender(), _initialSupplyOnMainEndpoint);
            isMain = true;
        }
        endpoint = ILayerZeroEndpoint(_endpoint);
    }

    function _nonblockingLzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64 _nonce,
        bytes memory _payload
    ) internal override {
        //        (address _dstOmnichainNFTAddress, uint256 omnichainNFT_tokenId) = abi.decode(_payload, (address, uint256));
        //        _safeMint(_dstOmnichainNFTAddress, omnichainNFT_tokenId);
    }

    function sendTokens(
        uint16 _dstChainId,
        bytes calldata _toAddress,
        uint256 _amount,
        address _zroPaymentAddress,
        bytes calldata _adapterParam
    ) external payable override {
        _sendTokens(_msgSender(), _dstChainId, _toAddress, _amount, _zroPaymentAddress, _adapterParam);
    }

    // todo: refund address
    function sendTokensFrom(
        address _from,
        uint16 _dstChainId,
        bytes calldata _toAddress,
        uint256 _amount,
        address _zroPaymentAddress,
        bytes calldata _adapterParam
    ) external payable override {
        address spender = _msgSender();
        _spendAllowance(_from, spender, _amount);
        _sendTokens(_from, _dstChainId, _toAddress, _amount, _zroPaymentAddress, _adapterParam);
    }

    function _sendTokens(
        address _from,
        uint16 _dstChainId,
        bytes calldata _toAddress,
        uint256 _amount,
        address _zroPaymentAddress,
        bytes calldata _adapterParam
    ) internal {
        if (isMain) {
            // lock by transferring to this contract if leaving the main chain,
            _transfer(_from, address(this), _amount);
        } else {
            // burn if leaving non-main chain
            _burn(_from, _amount);
        }

        bytes memory payload = abi.encode(_toAddress, _amount);

        _lzSend(_dstChainId, payload, payable(_from), _zroPaymentAddress, _adapterParam);
        // send LayerZero message
        uint64 nonce = endpoint.getOutboundNonce(_dstChainId, address(this));

        emit SendToChain(_from, _dstChainId, _toAddress, _amount, nonce);
    }
}
