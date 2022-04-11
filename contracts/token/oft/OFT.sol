// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../lzApp/NonblockingLzApp.sol";
import "./IOFT.sol";

// override decimal() function is needed
contract OFT is NonblockingLzApp, IOFT, ERC20 {

    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        uint256 _initialSupply
    ) ERC20(_name, _symbol) NonblockingLzApp(_lzEndpoint) {
        _mint(_msgSender(), _initialSupply);
    }


    function _nonblockingLzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64 _nonce,
        bytes memory _payload
    ) internal virtual override {
        // decode and load the toAddress
        (bytes memory toAddressBytes, uint256 amount) = abi.decode(_payload, (bytes, uint256));
        address toAddress;
        assembly {
            toAddress := mload(add(toAddressBytes, 20))
        }

        _creditTo(_srcChainId, toAddress, amount);

        emit ReceiveFromChain(_srcChainId, toAddress, amount, _nonce);
    }

    function estimateSendFee(
        uint16 _dstChainId,
        bytes calldata _toAddress,
        bool _useZro,
        uint _amount,
        bytes calldata _txParameters
    ) external view returns (uint256 nativeFee, uint256 zroFee) {
        // mock the payload for send()
        bytes memory payload = abi.encode(_toAddress, _amount);
        return lzEndpoint.estimateFees(_dstChainId, address(this), payload, _useZro, _txParameters);
    }

    /**
     * @dev send `_amount` amount of token to (`_dstChainId`, `_toAddress`)
     * `_dstChainId` the destination chain identifier
     * `_toAddress` can be any size depending on the `dstChainId`.
     * `_amount` the quantity of tokens in wei
     * `_refundAddress` the address LayerZero refunds if too much message fee is sent
     * `_zroPaymentAddress` set to address(0x0) if not paying in ZRO (LayerZero Token)
     * `_adapterParams` is a flexible bytes array to indicate messaging adapter services
     */
    function send(
        uint16 _dstChainId,
        bytes calldata _toAddress,
        uint256 _amount,
        address payable _refundAddress,
        address _zroPaymentAddress,
        bytes calldata _adapterParam
    ) external payable override {
        _send(_msgSender(), _dstChainId, _toAddress, _amount, _refundAddress, _zroPaymentAddress, _adapterParam);
    }

    function sendFrom(
        address _from,
        uint16 _dstChainId,
        bytes calldata _toAddress,
        uint256 _amount,
        address payable _refundAddress,
        address _zroPaymentAddress,
        bytes calldata _adapterParam
    ) external payable virtual override {
        _spendAllowance(_from, _msgSender(), _amount);
        _send(_from, _dstChainId, _toAddress, _amount, _refundAddress, _zroPaymentAddress, _adapterParam);
    }

    function _send(
        address _from,
        uint16 _dstChainId,
        bytes memory _toAddress,
        uint256 _amount,
        address payable _refundAddress,
        address _zroPaymentAddress,
        bytes calldata _adapterParam
    ) internal virtual {
        _debitFrom(_from, _dstChainId, _toAddress, _amount);

        bytes memory payload = abi.encode(_toAddress, _amount);
        _lzSend(_dstChainId, payload, _refundAddress, _zroPaymentAddress, _adapterParam);

        uint64 nonce = lzEndpoint.getOutboundNonce(_dstChainId, address(this));
        emit SendToChain(_from, _dstChainId, _toAddress, _amount, nonce);
    }

    function _debitFrom(
        address _from,
        uint16 _dstChainId,
        bytes memory _toAddress,
        uint256 _amount
    ) internal virtual {
        _burn(_from, _amount);
    }

    function _creditTo(
        uint16 _srcChainId,
        address _toAddress,
        uint256 _amount
    ) internal virtual {
        _mint(_toAddress, _amount);
    }
}
