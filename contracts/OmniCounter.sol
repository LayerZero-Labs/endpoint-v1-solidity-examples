// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
pragma abicoder v2;

import "./lzApp/NonblockingLzApp.sol";

contract OmniCounter is NonblockingLzApp {
    // count of messages have been received
    uint256 public ctr;

    constructor(address _lzEndpoint) NonblockingLzApp(_lzEndpoint) {}

    function getCounter() public view returns (uint256) {
        return messageCounter;
    }

    // implementation of the LayerZero message receiver.
    // on receive, increment a counter
    function _nonblockingLzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64, /*_nonce*/
        bytes memory /*_payload*/
    ) internal override {
        ctr += 1;
    }

    // send a message to the chainId, incrementing the counter on the destination
    function incrementCounter(uint16 _dstChainId) public payable {
        _lzSend(_dstChainId, bytes(""), payable(msg.sender), address(0x0), bytes(""));
    }

}
