// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../OFTCore.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "hardhat/console.sol";

contract NativeProxyOFT is ReentrancyGuard, ERC20, NonblockingLzApp, ERC165 {
    using SafeERC20 for IERC20;

    uint public constant NO_EXTRA_GAS = 0;
    uint public constant FUNCTION_TYPE_SEND = 1;
    bool public useCustomAdapterParams;

    event SendToChain(uint16 indexed _dstChainId, address indexed _from, bytes indexed _toAddress, uint _amount);
    event ReceiveFromChain(uint16 indexed _srcChainId, bytes indexed _srcAddress, address indexed _toAddress, uint _amount);

    constructor(string memory _name, string memory _symbol, address _lzEndpoint) ERC20(_name, _symbol) NonblockingLzApp(_lzEndpoint) {}

    function estimateSendFee(uint16 _dstChainId, bytes memory _toAddress, uint _amount, bool _useZro, bytes memory _adapterParams) public view returns (uint nativeFee, uint zroFee) {
        // mock the payload for send()
        bytes memory payload = abi.encode(_toAddress, _amount);
        return lzEndpoint.estimateFees(_dstChainId, address(this), payload, _useZro, _adapterParams);
    }
//
//    function sendFrom(address _from, uint16 _dstChainId, bytes memory _toAddress, uint _totalAmount, uint _mintAmount, address payable _refundAddress, address _zroPaymentAddress, bytes memory _adapterParams) public payable {
//        _send(_from, _dstChainId, _toAddress, _totalAmount, _mintAmount, _refundAddress, _zroPaymentAddress, _adapterParams);
//    }

    function _nonblockingLzReceive(uint16 _srcChainId, bytes memory _srcAddress, uint64 /*_nonce*/, bytes memory _payload) internal virtual override {

        // decode and load the toAddress
        (bytes memory toAddressBytes, uint amount) = abi.decode(_payload, (bytes, uint));
        address toAddress;
        assembly {
            toAddress := mload(add(toAddressBytes, 20))
        }

        _creditTo(_srcChainId, toAddress, amount);

        emit ReceiveFromChain(_srcChainId, _srcAddress, toAddress, amount);
    }

    function _send(uint16 _dstChainId, bytes memory _toAddress, uint _totalAmount, uint _mintAmount, address payable _refundAddress, address _zroPaymentAddress, bytes memory _adapterParams) public payable {
        _debitFrom(msg.sender, _dstChainId, _toAddress, _totalAmount, _mintAmount);

        // messageFee is the remainder of the msg.value after wrap
        uint256 messageFee = msg.value - _mintAmount;

        bytes memory payload = abi.encode(_toAddress, _totalAmount);
        if(useCustomAdapterParams) {
            _checkGasLimit(_dstChainId, FUNCTION_TYPE_SEND, _adapterParams, NO_EXTRA_GAS);
        } else {
            require(_adapterParams.length == 0, "NativeProxyOFT: _adapterParams must be empty.");
        }

        bytes memory trustedRemote = trustedRemoteLookup[_dstChainId];
        require(trustedRemote.length != 0, "NativeProxyOFT: destination chain is not a trusted source");
        lzEndpoint.send{value: messageFee}(_dstChainId, trustedRemote, payload, _refundAddress, _zroPaymentAddress, _adapterParams);
        emit SendToChain(_dstChainId, msg.sender, _toAddress, _totalAmount);
    }

    function setUseCustomAdapterParams(bool _useCustomAdapterParams) external onlyOwner {
        useCustomAdapterParams = _useCustomAdapterParams;
    }

    function deposit() external payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint _amount) external nonReentrant {
        require(balanceOf(msg.sender) >= _amount, "NativeProxyOFT: Insufficient balance.");
        _burn(msg.sender, _amount);
        (bool success, ) = msg.sender.call{value: _amount}("");
        require(success, "NativeProxyOFT: failed to unwrap");
    }

    function _debitFrom(uint16, bytes memory, uint _totalAmount, uint _mintAmount) internal {
        require(msg.value > _mintAmount, "NativeProxyOFT: msg.value must be > mintAmount.");
        _mint(msg.sender, _mintAmount);

        require(balanceOf(msg.sender) >= _totalAmount, "NativeProxyOFT: Insufficient balance.");
        _burn(msg.sender, _totalAmount);
        _mint(address(this), _totalAmount);
    }

    function _creditTo(uint16, address _toAddress, uint _amount) internal {
        require(balanceOf(address(this)) >= _amount, "NativeProxyOFT: msg.value must be > _amount");
        _burn(address(this), _amount);
        (bool success, ) = _toAddress.call{value: _amount}("");
        require(success, "NativeProxyOFT: failed to _creditTo");
    }
}
