pragma solidity ^0.8.4;

import "./interfaces/ILayerZeroReceiver.sol";
import "./interfaces/ILayerZeroEndpoint.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// deploy this contract to 2+ chains for testing.
//
// sendTokens() function works like this:
//  1. burn local tokens (logic in sendTokens)
//  2. send a LayerZero message to the destination MultiChainToken address on another chain
//  3. mint tokens on destination (logic in lzReceive)
contract MultiChainToken is ERC20, ILayerZeroReceiver {

    ILayerZeroEndpoint public endpoint;

    // constructor mints tokens to the deployer
    constructor(string memory name_, string memory symbol_, address _layerZeroEndpoint) ERC20(name_, symbol_){
        endpoint = ILayerZeroEndpoint(_layerZeroEndpoint);
        _mint(msg.sender, 1_000_000 * 10**18); // mint the deployer 100 tokens.
    }

    // send tokens to another chain.
    // this function sends the tokens from your address to the same address on the destination.
    function sendTokens(
        uint16 _chainId,                            // send tokens to this chainId
        bytes calldata _dstMultiChainTokenAddr,     // destination address of MultiChainToken
        uint _qty                                   // how many tokens to send
    )
    public
    payable
    {
        // burn the tokens locally.
        // tokens will be minted on the destination.
        require(
            allowance(msg.sender, address(this)) >= _qty,
            "You need to approve the contract to send your tokens!"
        );

        // and burn the local tokens *poof*
        _burn(msg.sender, _qty);

        // abi.encode() the payload with the values to send
        bytes memory payload = abi.encode(msg.sender, _qty);

        // send LayerZero message
        endpoint.send{value:msg.value}(
            _chainId,                       // destination chainId
            _dstMultiChainTokenAddr,        // destination address of MultiChainToken
            payload,                        // abi.encode()'ed bytes
            payable(msg.sender),            // refund address (LayerZero will refund any superflous gas back to caller of send()
            address(0x0),                   // 'zroPaymentAddress' unused for this mock/example
            bytes("")                       // 'txParameters' unused for this mock/example
        );
    }

    // receive the bytes payload from the source chain via LayerZero
    // _fromAddress is the source MultiChainToken address
    function lzReceive(uint16 _srcChainId, bytes memory _fromAddress, uint64 _nonce, bytes memory _payload) override external{
        require(msg.sender == address(endpoint)); // boilerplate! lzReceive must be called by the endpoint for security

        // decode
        (address toAddr, uint qty) = abi.decode(_payload, (address, uint));

        // mint the tokens back into existence, to the toAddr from the message payload
        _mint(toAddr, qty);
    }

}
