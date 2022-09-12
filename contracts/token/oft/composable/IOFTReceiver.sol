// SPDX-License-Identifier: BUSL-1.1

pragma solidity >=0.5.0;

interface IOFTReceiver {
    /**
     * @dev Called by the OFT contract when tokens are received from source chain.
     * @param _srcChainId The chain id of the source chain.
     * @param _srcOFTAddress The address of the OFT token contract on the source chain.
     * @param _nonce The nonce of the transaction on the source chain.
     * @param _srcCaller The address of the caller who calls the sendAndCall() on the source chain.
     * @param _srcFrom The address of the sender of the token on source chain.
     * @param _amount The amount of tokens to transfer.
     * @param _payload Additional data with no specified format.
     */
    function onOFTReceived(uint16 _srcChainId, bytes calldata _srcOFTAddress, uint64 _nonce, bytes calldata _srcCaller, bytes calldata _srcFrom, uint _amount, bytes calldata _payload) external;
}
