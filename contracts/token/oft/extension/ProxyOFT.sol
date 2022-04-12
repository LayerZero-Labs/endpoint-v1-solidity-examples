// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../../../lzApp/NonblockingLzApp.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ProxyOFT is NonblockingLzApp {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;

    event SendToChain(address indexed _sender, uint16 indexed _dstChainId, bytes indexed _toAddress, uint _amount, uint64 _nonce);
    event ReceiveFromChain(uint16 _srcChainId, address _toAddress, uint _amount, uint64 _nonce);

    constructor(address _lzEndpoint, address _proxyToken) NonblockingLzApp(_lzEndpoint) {
        token = IERC20(_proxyToken);
    }

    function send(uint16 _dstChainId, bytes calldata _toAddress, uint _amount, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParam) public payable virtual {
        _send(_msgSender(), _dstChainId, _toAddress, _amount, _refundAddress, _zroPaymentAddress, _adapterParam);
    }

    function sendFrom(address _from, uint16 _dstChainId, bytes calldata _toAddress, uint _amount, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParam) public payable virtual {
        _send(_from, _dstChainId, _toAddress, _amount, _refundAddress, _zroPaymentAddress, _adapterParam);
    }

    function estimateSendFee(uint16 _dstChainId, bytes calldata _toAddress, bool _useZro, uint _amount, bytes calldata _adapterParams) public view virtual returns (uint nativeFee, uint zroFee) {
        // mock the payload for send()
        bytes memory payload = abi.encode(_toAddress, _amount);
        return lzEndpoint.estimateFees(_dstChainId, address(this), payload, _useZro, _adapterParams);
    }

    // using the proxy Token's total supply as source of truth
    function totalSupply() public view virtual returns (uint) {
        return token.totalSupply();
    }

    function _nonblockingLzReceive(uint16 _srcChainId, bytes memory _srcAddress, uint64 _nonce, bytes memory _payload) internal virtual override {
        // decode and load the toAddress
        (bytes memory toAddressBytes, uint amount) = abi.decode(_payload, (bytes, uint));
        address toAddress;
        assembly {
            toAddress := mload(add(toAddressBytes, 20))
        }

        _creditTo(_srcChainId, toAddress, amount);

        emit ReceiveFromChain(_srcChainId, toAddress, amount, _nonce);
    }

    function _send(address _from, uint16 _dstChainId, bytes memory _toAddress, uint _amount, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParam) internal virtual {
        _debitFrom(_from, _dstChainId, _toAddress, _amount);

        bytes memory payload = abi.encode(_toAddress, _amount);
        _lzSend(_dstChainId, payload, _refundAddress, _zroPaymentAddress, _adapterParam);

        uint64 nonce = lzEndpoint.getOutboundNonce(_dstChainId, address(this));
        emit SendToChain(_from, _dstChainId, _toAddress, _amount, nonce);
    }

    function _debitFrom(address _from, uint16 _dstChainId, bytes memory _toAddress, uint _amount) internal virtual {
        token.safeTransferFrom(_from, address(this), _amount);
    }

    function _creditTo(uint16 _srcChainId, address _toAddress, uint _amount) internal virtual {
        token.safeTransfer(_toAddress, _amount);
    }
}
