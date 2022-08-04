// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "../../../lzApp/NonblockingLzApp.sol";

contract NativeOFT is NonblockingLzApp, ReentrancyGuard, ERC20, ERC165 {
    using SafeERC20 for IERC20;

    uint public constant NO_EXTRA_GAS = 0;
    uint public constant FUNCTION_TYPE_SEND = 1;
    bool public useCustomAdapterParams;

    event SetUseCustomAdapterParams(bool _useCustomAdapterParams);
    event SendToChain(uint16 indexed _dstChainId, address indexed _from, bytes indexed _toAddress, uint _amount);
    event ReceiveFromChain(uint16 indexed _srcChainId, bytes indexed _srcAddress, address indexed _toAddress, uint _amount);
    event Deposit(address indexed _dst, uint _amount);
    event Withdrawal(address indexed _src, uint _amount);

    constructor(string memory _name, string memory _symbol, address _lzEndpoint) ERC20(_name, _symbol) NonblockingLzApp(_lzEndpoint) {}

    function estimateSendFee(uint16 _dstChainId, bytes memory _toAddress, uint _amount, bool _useZro, bytes memory _adapterParams) public view returns (uint nativeFee, uint zroFee) {
        bytes memory payload = abi.encode(_toAddress, _amount);
        return lzEndpoint.estimateFees(_dstChainId, address(this), payload, _useZro, _adapterParams);
    }

    function sendFrom(address _from, uint16 _dstChainId, bytes memory _toAddress, uint _amount, address payable _refundAddress, address _zroPaymentAddress, bytes memory _adapterParams) public payable {
        _send(_from, _dstChainId, _toAddress, _amount, _refundAddress, _zroPaymentAddress, _adapterParams);
    }

    function _nonblockingLzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64, /*_nonce*/
        bytes memory _payload
    ) internal virtual override {
        (bytes memory toAddressBytes, uint amount) = abi.decode(_payload, (bytes, uint));
        address toAddress;
        assembly {
            toAddress := mload(add(toAddressBytes, 20))
        }

        _creditTo(_srcChainId, toAddress, amount);

        emit ReceiveFromChain(_srcChainId, _srcAddress, toAddress, amount);
    }

    function _send(address _from, uint16 _dstChainId, bytes memory _toAddress, uint _amount, address payable _refundAddress, address _zroPaymentAddress, bytes memory _adapterParams) public payable {
        uint messageFee = _debitFrom(_from, _dstChainId, _toAddress, _amount);

        bytes memory payload = abi.encode(_toAddress, _amount);
        if (useCustomAdapterParams) {
            _checkGasLimit(_dstChainId, FUNCTION_TYPE_SEND, _adapterParams, NO_EXTRA_GAS);
        } else {
            require(_adapterParams.length == 0, "NativeOFT: _adapterParams must be empty.");
        }

        bytes memory trustedRemote = trustedRemoteLookup[_dstChainId];
        require(trustedRemote.length != 0, "NativeOFT: destination chain is not a trusted source");
        lzEndpoint.send{value: messageFee}(_dstChainId, trustedRemote, payload, _refundAddress, _zroPaymentAddress, _adapterParams);
        emit SendToChain(_dstChainId, _from, _toAddress, _amount);
    }

    function setUseCustomAdapterParams(bool _useCustomAdapterParams) external onlyOwner {
        useCustomAdapterParams = _useCustomAdapterParams;
        emit SetUseCustomAdapterParams(_useCustomAdapterParams);
    }

    function deposit() public payable {
        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint _amount) public nonReentrant {
        require(balanceOf(msg.sender) >= _amount, "NativeOFT: Insufficient balance.");
        _burn(msg.sender, _amount);
        (bool success, ) = msg.sender.call{value: _amount}("");
        require(success, "NativeOFT: failed to unwrap");
        emit Withdrawal(msg.sender, _amount);
    }

    function _debitFrom(address _from, uint16, bytes memory, uint _amount) internal returns (uint messageFee) {
        messageFee = msg.sender == _from ? _debitMsgSender(_amount) : _debitMsgFrom(_from, _amount);
    }

    function _debitMsgSender(uint _amount) internal returns (uint messageFee) {
        uint msgSenderBalance = balanceOf(msg.sender);

        if (msgSenderBalance < _amount) {
            require(msgSenderBalance + msg.value >= _amount, "NativeOFT: Insufficient msg.value");

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
            require(msgFromBalance + msg.value >= _amount, "NativeOFT: Insufficient msg.value");

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

    function _creditTo(uint16, address _toAddress, uint _amount) internal {
        _burn(address(this), _amount);
        (bool success, ) = _toAddress.call{value: _amount}("");
        require(success, "NativeOFT: failed to _creditTo");
    }

    receive() external payable {
        deposit();
    }
}
