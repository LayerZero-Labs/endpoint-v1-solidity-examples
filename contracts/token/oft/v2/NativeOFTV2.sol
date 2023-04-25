// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./OFTV2.sol";

contract NativeOFTV2 is OFTV2, ReentrancyGuard {

    event Deposit(address indexed _dst, uint _amount);
    event Withdrawal(address indexed _src, uint _amount);

    constructor(string memory _name, string memory _symbol, uint8 _sharedDecimals, address _lzEndpoint) OFTV2(_name, _symbol, _sharedDecimals, _lzEndpoint) {}

    function sendFrom(address _from, uint16 _dstChainId, bytes32 _toAddress, uint _amount, LzCallParams calldata _callParams) public payable virtual override {
        _send(_from, _dstChainId, _toAddress, _amount, _callParams.refundAddress, _callParams.zroPaymentAddress, _callParams.adapterParams);
    }

     function _send(address _from, uint16 _dstChainId, bytes32 _toAddress, uint _amount, address payable _refundAddress, address _zroPaymentAddress, bytes memory _adapterParams) internal virtual override returns (uint) {
        // remove dust from _amount and send it back to the debitor
        (uint amount, uint dust) = _removeDust(_amount);
        address debitor = msg.sender == _from ? msg.sender : _from;
         if (dust > 0) _transfer(debitor, address(this), dust);
        
        uint messageFee = _debitFromNative(_from, _dstChainId, _toAddress, amount);
        bytes memory lzPayload = _encodeSendPayload(_toAddress, _ld2sd(amount));

        if (useCustomAdapterParams) {
            _checkGasLimit(_dstChainId, PT_SEND, _adapterParams, NO_EXTRA_GAS);
        } else {
            require(_adapterParams.length == 0, "NativeOFTV2: _adapterParams must be empty.");
        }

        _lzSend(_dstChainId, lzPayload, _refundAddress, _zroPaymentAddress, _adapterParams, messageFee);

        return amount;
    }

    function deposit() public payable {
        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint _amount) public nonReentrant {
        require(balanceOf(msg.sender) >= _amount, "NativeOFTV2: Insufficient balance.");
        _burn(msg.sender, _amount);
        (bool success, ) = msg.sender.call{value: _amount}("");
        require(success, "NativeOFTV2: failed to unwrap");
        emit Withdrawal(msg.sender, _amount);
    }

    function _debitFromNative(address _from, uint16, bytes32, uint _amount) internal returns (uint messageFee) {
        messageFee = msg.sender == _from ? _debitMsgSender(_amount) : _debitMsgFrom(_from, _amount);
    }

    function _debitMsgSender(uint _amount) internal returns (uint messageFee) {
        uint msgSenderBalance = balanceOf(msg.sender);

        if (msgSenderBalance < _amount) {
            require(msgSenderBalance + msg.value >= _amount, "NativeOFTV2: Insufficient msg.value");

            // user can cover difference with additional msg.value ie. wrapping
            uint mintAmount = _amount - msgSenderBalance;
            _mint(address(msg.sender), mintAmount);

            // update the messageFee to take out mintAmount
            messageFee = msg.value - mintAmount;
        } else {
            messageFee = msg.value;
        }

        _transfer(msg.sender, address(this), _amount);
        return messageFee;
    }

    function _debitMsgFrom(address _from, uint _amount) internal returns (uint messageFee) {
        uint msgFromBalance = balanceOf(_from);

        if (msgFromBalance < _amount) {
            require(msgFromBalance + msg.value >= _amount, "NativeOFTV2: Insufficient msg.value");

            // user can cover difference with additional msg.value ie. wrapping
            uint mintAmount = _amount - msgFromBalance;
            _mint(address(msg.sender), mintAmount);

            // transfer the differential amount to the contract
            _transfer(msg.sender, address(this), mintAmount);

            // overwrite the _amount to take the rest of the balance from the _from address
            _amount = msgFromBalance;

            // update the messageFee to take out mintAmount
            messageFee = msg.value - mintAmount;
        } else {
            messageFee = msg.value;
        }

        _spendAllowance(_from, msg.sender, _amount);
        _transfer(_from, address(this), _amount);
        return messageFee;
    }

    // function _creditTo(uint16, address _toAddress, uint _amount) internal override(OFT) returns(uint) {
    //     _burn(address(this), _amount);
    //     (bool success, ) = _toAddress.call{value: _amount}("");
    //     require(success, "NativeOFT: failed to _creditTo");
    //     return _amount;
    // }

    receive() external payable {
        deposit();
    }

}