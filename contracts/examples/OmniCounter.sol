// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.4;
pragma abicoder v2;

import "../lzApp/NonblockingLzApp.sol";

contract OmniCounter is NonblockingLzApp {
    // keep track of how many messages have been received from other chains
    uint256 public messageCounter;

    constructor(address _lzEndpoint) NonblockingLzApp(_lzEndpoint) {}

    function getCounter() public view returns (uint256) {
        return messageCounter;
    }

    // overrides lzReceive function in ILayerZeroReceiver.
    // automatically invoked on the receiving chain after the source chain calls endpoint.send(...)
    function _nonblockingLzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64, /*_nonce*/
        bytes memory /*_payload*/
    ) internal override {
        messageCounter += 1;
    }

    // custom function that wraps endpoint.send(...) which will
    // cause lzReceive() to be called on the destination chain!
    function incrementCounter(uint16 _dstChainId) public payable {
        _lzSend(_dstChainId, bytes(""), payable(msg.sender), address(0x0), bytes(""));
    }

    // _adapterParams (v1)
    // customize the gas amount to be used on the destination chain.
    function incrementCounterWithAdapterParamsV1(
        uint16 _dstChainId,
        bytes calldata _dstCounterMockAddress,
        uint256 gasAmountForDst
    ) public payable {
        uint16 version = 1;
        // make look like this: 0x00010000000000000000000000000000000000000000000000000000000000030d40
        bytes memory _adapterParams = abi.encodePacked(version, gasAmountForDst);
        lzEndpoint.send{value: msg.value}(
            _dstChainId,
            _dstCounterMockAddress,
            bytes(""),
            payable(msg.sender),
            address(0x0),
            _adapterParams
        );
    }

    // _adapterParams (v2)
    // specify a small amount of notive token you want to airdropped to your wallet on destination
    function incrementCounterWithAdapterParamsV2(
        uint16 _dstChainId,
        bytes calldata _dstCounterMockAddress,
        uint256 gasAmountForDst,
        uint256 airdropEthQty,
        address airdropAddr
    ) public payable {
        uint16 version = 2;
        bytes memory _adapterParams = abi.encodePacked(
            version,
            gasAmountForDst,
            airdropEthQty, // how must dust to receive on destination
            airdropAddr // the address to receive the dust
        );
        lzEndpoint.send{value: msg.value}(
            _dstChainId,
            _dstCounterMockAddress,
            bytes(""),
            payable(msg.sender),
            address(0x0),
            _adapterParams
        );
    }

    // call send() to multiple destinations in the same transaction!
    // using a naive way to compute the the avg msg.value for each chain.
    // but some path might cost much more.
    function incrementMultiCounter(
        uint16[] calldata _dstChainIds,
        bytes[] calldata _dstCounterMockAddresses,
        address payable _refundAddr
    ) public payable {
        require(_dstChainIds.length == _dstCounterMockAddresses.length, "_dstChainIds.length, _dstCounterMockAddresses.length not the same");

        uint256 numberOfChains = _dstChainIds.length;

        // note: could result in a few wei of dust left in contract
        uint256 valueToSend = msg.value / numberOfChains;

        // send() each chainId + dst address pair
        for (uint256 i = 0; i < numberOfChains; ++i) {
            // a Communicator.sol instance is the 'endpoint'
            // .send() each payload to the destination chainId + UA destination address
            lzEndpoint.send{value: valueToSend}(
                _dstChainIds[i],
                _dstCounterMockAddresses[i],
                bytes(""),
                _refundAddr,
                address(0x0),
                bytes("")
            );
        }

        // refund eth if too much was sent into this contract call
        uint256 refund = msg.value - (valueToSend * numberOfChains);
        _refundAddr.transfer(refund);
    }

    // allow this contract to receive ether
    fallback() external payable {}

    receive() external payable {}
}
