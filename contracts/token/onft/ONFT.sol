// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IONFT.sol";
import "../../lzApp/NonblockingLzApp.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

// NOTE: this ONFT contract has no minting logic.
// must implement your own minting logic in child classes
abstract contract ONFT is IONFT, NonblockingLzApp, ERC721 {
    string public baseTokenURI;

    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint
    ) ERC721(_name, _symbol) NonblockingLzApp(_lzEndpoint) {}

    function sendTokenFrom(
        address _from,
        uint16 _dstChainId,
        bytes calldata _toAddress,
        uint256 _tokenId,
        address payable _refundAddress,
        address _zroPaymentAddress,
        bytes calldata _adapterParam
    ) external payable virtual override {
        require(_isApprovedOrOwner(_msgSender(), _tokenId), "ERC721: transfer caller is not owner nor approved");
        _sendToken(_from, _dstChainId, _toAddress, _tokenId, _refundAddress, _zroPaymentAddress, _adapterParam);
    }

    function sendToken(
        uint16 _dstChainId,
        bytes calldata _toAddress,
        uint256 _tokenId,
        address payable _refundAddress,
        address _zroPaymentAddress,
        bytes calldata _adapterParam
    ) external payable virtual override {
        _sendToken(_msgSender(), _dstChainId, _toAddress, _tokenId, _refundAddress, _zroPaymentAddress, _adapterParam);
    }

    function _sendToken(
        address _from,
        uint16 _dstChainId,
        bytes memory _toAddress,
        uint256 _tokenId,
        address payable _refundAddress,
        address _zroPaymentAddress,
        bytes calldata _adapterParam
    ) internal virtual {
        _beforeSendToken(_from, _dstChainId, _toAddress, _tokenId);

        bytes memory payload = abi.encode(_toAddress, _tokenId);
        _lzSend(_dstChainId, payload, _refundAddress, _zroPaymentAddress, _adapterParam);

        uint64 nonce = lzEndpoint.getOutboundNonce(_dstChainId, address(this));
        emit SendToChain(_from, _dstChainId, _toAddress, _tokenId, nonce);
        _afterSendToken(_from, _dstChainId, _toAddress, _tokenId);
    }

    function _nonblockingLzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64 _nonce,
        bytes memory _payload
    ) internal virtual override {
        _beforeReceiveToken(_srcChainId, _srcAddress, _payload);

        // decode and load the toAddress
        (bytes memory toAddress, uint256 tokenId) = abi.decode(_payload, (bytes, uint256));
        address localToAddress;
        assembly {
            toAddress := mload(add(toAddress, 20))
        }
        // if the toAddress is 0x0, burn it or it will get cached
        if (localToAddress == address(0x0)) localToAddress == address(0xdEaD);

        _afterReceiveToken(_srcChainId, localToAddress, tokenId);

        emit ReceiveFromChain(_srcChainId, localToAddress, tokenId, _nonce);
    }

    function _beforeSendToken(
        address, // _from
        uint16, // _dstChainId
        bytes memory, // _toAddress
        uint256 _tokenId
    ) internal virtual {
        _burn(_tokenId);
    }

    function _afterSendToken(
        address, // _from
        uint16, // _dstChainId
        bytes memory, // _toAddress
        uint256 // _tokenId
    ) internal virtual {}

    function _beforeReceiveToken(
        uint16, // _srcChainId
        bytes memory, // _srcAddress
        bytes memory // _payload
    ) internal virtual {}

    function _afterReceiveToken(
        uint16, // _srcChainId
        address _toAddress,
        uint256 _tokenId
    ) internal virtual {
        _safeMint(_toAddress, _tokenId);
    }

    /// @notice Set the baseTokenURI
    /// @param _baseTokenURI to set
    function setBaseURI(string memory _baseTokenURI) public onlyOwner {
        baseTokenURI = _baseTokenURI;
    }

    /// @notice Get the base URI
    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }
}
