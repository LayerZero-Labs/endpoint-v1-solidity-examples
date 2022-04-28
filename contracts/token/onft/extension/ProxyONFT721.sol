// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../../../lzApp/NonblockingLzApp.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "../IONFT721.sol";

contract ProxyONFT721 is NonblockingLzApp, IERC721Receiver {
    IERC721 public immutable token;

    event SendToChain(address indexed _sender, uint16 indexed _dstChainId, bytes indexed _toAddress, uint _tokenId, uint64 _nonce);
    event ReceiveFromChain(uint16 _srcChainId, address _toAddress, uint _tokenId, uint64 _nonce);

    constructor(address _lzEndpoint, address _proxyToken) NonblockingLzApp(_lzEndpoint) {
        token = IERC721(_proxyToken);
    }

    function estimateSendFee(uint16 _dstChainId, bytes calldata _toAddress, bool _useZro, uint _tokenId, bytes calldata _adapterParams) external view virtual returns (uint nativeFee, uint zroFee) {
        // mock the payload for send()
        bytes memory payload = abi.encode(_toAddress, _tokenId);
        return lzEndpoint.estimateFees(_dstChainId, address(this), payload, _useZro, _adapterParams);
    }

    function send(uint16 _dstChainId, bytes calldata _toAddress, uint _tokenId, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParam) external payable virtual {
        _send(_msgSender(), _dstChainId, _toAddress, _tokenId, _refundAddress, _zroPaymentAddress, _adapterParam);
    }

    function _send(address _from, uint16 _dstChainId, bytes memory _toAddress, uint _tokenId, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParam) internal virtual {
        token.safeTransferFrom(_from, address(this), _tokenId);

        bytes memory payload = abi.encode(_toAddress, _tokenId);
        _lzSend(_dstChainId, payload, _refundAddress, _zroPaymentAddress, _adapterParam);

        uint64 nonce = lzEndpoint.getOutboundNonce(_dstChainId, address(this));
        emit SendToChain(_from, _dstChainId, _toAddress, _tokenId, nonce);
    }

    function _nonblockingLzReceive(uint16 _srcChainId, bytes memory /* _srcAddress */, uint64 _nonce, bytes memory _payload) internal virtual override {
        // decode and load the toAddress
        (bytes memory toAddress, uint tokenId) = abi.decode(_payload, (bytes, uint));
        address localToAddress;
        assembly {
            localToAddress := mload(add(toAddress, 20))
        }
        // if the toAddress is 0x0, burn it or it will get cached
        if (localToAddress == address(0x0)) localToAddress == address(0xdEaD);

        token.safeTransferFrom(address(this), localToAddress, tokenId);

        emit ReceiveFromChain(_srcChainId, localToAddress, tokenId, _nonce);
    }

    function onERC721Received(address, address, uint, bytes memory) public virtual override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
