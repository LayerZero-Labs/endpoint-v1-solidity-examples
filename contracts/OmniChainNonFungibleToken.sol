// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ILayerZeroReceiver.sol";
import "./interfaces/ILayerZeroEndpoint.sol";

contract OmniChainNonFungibleToken is Ownable, ERC721, ILayerZeroReceiver {

    ILayerZeroEndpoint public endpoint;
    mapping(uint16 => bytes) public remotes;

    constructor(string memory name_, string memory symbol_, address _layerZeroEndpoint) ERC721(name_, symbol_){
        endpoint = ILayerZeroEndpoint(_layerZeroEndpoint);
    }

    // send OmniChainNonFungibleToken to another chain.
    // this function sends the OmniChainNFT from your address
    // to the same address on the destination.
    // burn OmniChainNFT_tokenId on source chain and mint on destination chain
    function transferOmniChainNFT(
        uint16 _chainId,                      // send OmniChainNFT to this chainId
        bytes calldata _dstOmniChainNFTAddr,   // destination address of OmniChainNFT
        uint256 omniChainNFT_tokenId
    ) public payable {
        address owner = ownerOf(omniChainNFT_tokenId);
        require(msg.sender == owner, "Message sender must own the OmniChainNFT");
        _burn(omniChainNFT_tokenId);
        bytes memory payload = abi.encode(msg.sender, omniChainNFT_tokenId);
        endpoint.send{value:msg.value}(
            _chainId,                 // destination chainId
            _dstOmniChainTokenAddr,   // destination address of OmniChainToken
            payload,                  // abi.encode()'ed bytes
            payable(msg.sender),      // refund address (LayerZero will refund any superflous gas back to caller of send()
            address(0x0),             // 'zroPaymentAddress' unused for this mock/example
            bytes("")                 // 'txParameters' unused for this mock/example
        );
    }

    // receive the bytes payload from the source chain via LayerZero
    // _fromAddress is the source OmniChainNonFungibleToken address
    function lzReceive(uint16 _srcChainId, bytes calldata _srcAddress, uint64 _nonce, bytes calldata _payload) override external {
        require(msg.sender == address(endpoint)); // boilerplate! lzReceive must be called by the endpoint for security
        require(
            _srcAddress.length == remotes[_srcChainId].length && keccak256(_srcAddress) == keccak256(remotes[_srcChainId]),
            "Invalid remote sender address. Owner should call setRemote() to enable remote contract"
        );
        (address _dstOmniChainNFTAddr, uint256 omniChainNFT_tokenId) = abi.decode(_payload, (address, uint256));
        // checking tokenId must not exist
         _safeMint(_dstOmniChainNFTAddr, omniChainNFT_tokenId);
    }

    // _chainId - the chainId for the remote contract
    // _remoteAddress - the contract address on the remote chainId
    // the owner must set remote contract addresses.
    // in lzReceive(), a require() ensures only messages
    // from known contracts can be received.
    function setRemote(uint16 _chainId, bytes calldata _remoteAddress) external onlyOwner {
        require(remotes[_chainId].length == 0, "The remote address has already been set for the chainId!");
        remotes[_chainId] = _remoteAddress;
    }
}