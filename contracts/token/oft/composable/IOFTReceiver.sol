// SPDX-License-Identifier: BUSL-1.1

pragma solidity >=0.5.0;

interface IOFTReceiver {
    function onOFTReceived(uint16 _srcChainId, bytes calldata _srcAddress, uint64 _nonce, bytes calldata _from, uint _amount, bytes calldata _payload) external;

    // if this view function does not revert, it means onOFTReceived() will likely not revert
    // it is the receiver's responsibility to implement this correctly for better liveness.
    function tryOnOFTReceived(uint16 _srcChainId, bytes calldata _srcAddress, uint64 _nonce, bytes calldata _from, uint _amount, bytes calldata _payload) external view;
}
