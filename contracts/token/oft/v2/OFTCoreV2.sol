// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../../../lzApp/NonblockingLzApp.sol";
import "../IOFTCore.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

abstract contract OFTCoreV2 is NonblockingLzApp, ERC165, IOFTCore {
    using BytesLib for bytes;

    uint8 public constant SHARE_DECIMALS = 6;
    uint public constant NO_EXTRA_GAS = 0;
    uint public constant BP_DENOMINATOR = 10000;

    // packet type
    uint8 public constant PT_SEND = 0;

    bool public useCustomAdapterParams;

    // base oft
    bool public isBaseOFT;
    uint64 public outboundAmountSD; // total outbound amount in share decimals, that is sent to other chains and should not exceed max of uint64

    // fee config
    mapping(uint16 => Fee) public chainIdToFeeBps;
    uint16 public globalFeeBp;
    address public feeOwner; // defaults to owner

    struct Fee {
        uint16 feeBP;
        bool enabled;
    }

    // todo: move into IOFTCore
    event SetFeeBp(uint16 dstchainId, bool enabled, uint16 feeBp);
    event SetGlobalFeeBp(uint feeBp);
    event SetFeeOwner(address feeOwner);
    event ReceiveFromChain2(uint16 indexed _srcChainId, address indexed _to, uint _amount);

    constructor(bool _base, address _lzEndpoint) NonblockingLzApp(_lzEndpoint) {
        isBaseOFT = _base;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IOFTCore).interfaceId || super.supportsInterface(interfaceId);
    }

    function estimateSendFee(uint16 _dstChainId, bytes calldata _toAddress, uint _amount, bool _useZro, bytes calldata _adapterParams) public view virtual override returns (uint nativeFee, uint zroFee) {
        // mock the payload for sendFrom()
        bytes memory payload = _encodeSendPayload(_toAddress, _ld2sd(_amount));
        return lzEndpoint.estimateFees(_dstChainId, address(this), payload, _useZro, _adapterParams);
    }

    function sendFrom(address _from, uint16 _dstChainId, bytes calldata _toAddress, uint _amount, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParams) public payable virtual override {
        _send(_from, _dstChainId, _toAddress, _amount, _refundAddress, _zroPaymentAddress, _adapterParams);
    }

    function setUseCustomAdapterParams(bool _useCustomAdapterParams) public virtual onlyOwner {
        useCustomAdapterParams = _useCustomAdapterParams;
        emit SetUseCustomAdapterParams(_useCustomAdapterParams);
    }

    function setGlobalFeeBp(uint16 _feeBp) external onlyOwner {
        require(_feeBp <= BP_DENOMINATOR,  "OFTCore: fee bp must be <= DP_DENOMINATOR");
        globalFeeBp = _feeBp;
        emit SetGlobalFeeBp(globalFeeBp);
    }

    function setFeeBp(uint16 _dstChainId, bool _enabled, uint16 _feeBp) external onlyOwner {
        require(_feeBp <= BP_DENOMINATOR,  "OFTCore: fee bp must be <= DP_DENOMINATOR");
        chainIdToFeeBps[_dstChainId] = Fee(_feeBp, _enabled);
        emit SetFeeBp(_dstChainId, _enabled, _feeBp);
    }

    function setFeeOwner(address _feeOwner) external onlyOwner {
        require(_feeOwner != address(0x0), "OFTFee: feeOwner cannot be 0x");
        feeOwner = _feeOwner;
        emit SetFeeOwner(_feeOwner);
    }

    function quoteOFTFee(uint16 _dstChainId, uint _amount) public view returns (uint amount, uint fee) {
        Fee memory feeConfig = chainIdToFeeBps[_dstChainId];
        if (feeConfig.enabled && feeConfig.feeBP > 0) {
            fee = _amount * feeConfig.feeBP / BP_DENOMINATOR;
            amount = _amount - fee;
        } else if (globalFeeBp > 0) {
            fee = _amount * globalFeeBp / BP_DENOMINATOR;
            amount = _amount - fee;
        } else {
            fee = 0;
            amount = _amount;
        }
    }

    function _nonblockingLzReceive(uint16 _srcChainId, bytes memory _srcAddress, uint64 _nonce, bytes memory _payload) internal virtual override {
        uint8 packetType = _payload.toUint8(0);

        if (packetType == PT_SEND) {
            _sendAck(_srcChainId, _srcAddress, _nonce, _payload);
        } else {
            revert("OFTCore: unknown packet type");
        }
    }

    // todo: remove dust
    function _send(address _from, uint16 _dstChainId, bytes memory _toAddress, uint _amount, address payable _refundAddress, address _zroPaymentAddress, bytes memory _adapterParams) internal virtual {
        _checkAdapterParams(_dstChainId, PT_SEND, _adapterParams, NO_EXTRA_GAS);

        (uint amount, uint fee) = quoteOFTFee(_dstChainId, _amount);
        // todo: transfer fee every time?
        if (fee > 0) _transferFrom(_from, feeOwner, fee); // payout the owner fee

        amount = _debitFrom(_from, _dstChainId, _toAddress, amount);

        uint64 amountSD = _ld2sd(amount);
        if (isBaseOFT) {
            require(type(uint32).max - outboundAmountSD >= amountSD, "OFTCore: outboundAmountSD overflow");
            outboundAmountSD += amountSD;
        }

        bytes memory lzPayload = _encodeSendPayload(_toAddress, amountSD);
        _lzSend(_dstChainId, lzPayload, _refundAddress, _zroPaymentAddress, _adapterParams, msg.value);

        emit SendToChain(_dstChainId, _from, _toAddress, amount);
    }

    function _sendAck(uint16 _srcChainId, bytes memory, uint64, bytes memory _payload) internal virtual {
        (address to, uint64 amountSD) = _decodeSendPayload(_payload);

        if (isBaseOFT) {
            outboundAmountSD -= amountSD;
        }
        uint amount = _sd2ld(amountSD);

        _creditTo(_srcChainId, to, amount);
        emit ReceiveFromChain2(_srcChainId, to, amount);
    }

    function _checkAdapterParams(uint16 _dstChainId, uint16 _pkType, bytes memory _adapterParams, uint _extraGas) internal virtual {
        if (useCustomAdapterParams) {
            _checkGasLimit(_dstChainId, _pkType, _adapterParams, _extraGas);
        } else {
            require(_adapterParams.length == 0, "OFTCore: _adapterParams must be empty.");
        }
    }

    function _ld2sdRate() internal view virtual returns (uint) {
        uint8 decimals = _decimals();
        bool isValid = isBaseOFT ? decimals >= SHARE_DECIMALS : decimals == SHARE_DECIMALS;
        require(isValid, "OFTCore: invalid decimals");
        return 10 ** (decimals - SHARE_DECIMALS);
    }

    function _ld2sd(uint _amount) internal virtual view returns (uint64) {
        uint amountSD = isBaseOFT ? _amount / _ld2sdRate() : _amount;
        require(amountSD <= type(uint64).max, "OFTCore: amountSD overflow");
        return uint64(amountSD);
    }

    function _sd2ld(uint64 _amountSD) internal virtual view returns (uint) {
        return isBaseOFT ? _amountSD * _ld2sdRate() : _amountSD;
    }

    function _removeDust(uint _amount) internal virtual view returns (uint) {
        uint dust = isBaseOFT ? _amount % _ld2sdRate() : 0;
        return _amount - dust;
    }

    function _encodeSendPayload(bytes memory _toAddress, uint64 _amountSD) internal virtual view returns (bytes memory) {
        return abi.encodePacked(PT_SEND, _toAddress, _amountSD);
    }

    function _decodeSendPayload(bytes memory _payload) internal virtual view returns (address to, uint64 amountSD) {
        require(_payload.toUint8(0) == PT_SEND && _payload.length == 29, "OFTCore: invalid send payload");
        to = _payload.toAddress(1);
        amountSD = _payload.toUint64(21);
    }

    function _debitFrom(address _from, uint16 _dstChainId, bytes memory _toAddress, uint _amount) internal virtual returns (uint);

    function _creditTo(uint16 _srcChainId, address _toAddress, uint _amount) internal virtual;

    function _transferFrom(address _from, address _to, uint _amount) internal virtual returns (uint);

    function _decimals() internal virtual view returns (uint8);
}
