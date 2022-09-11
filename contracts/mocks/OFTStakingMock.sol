// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../token/oft/composable/IOFTReceiver.sol";
import "../token/oft/composable/IComposableOFT.sol";
import "../util/BytesLib.sol";

import "hardhat/console.sol";

// OFTStakingMock is an example to integrate with OFT. It shows how to send OFT cross chain with a custom payload and
// call a receiver contract on the destination chain when oft is received.
contract OFTStakingMock is IOFTReceiver {
    using SafeERC20 for IERC20;
    using BytesLib for bytes;

    uint public constant DST_GAS_FOR_CALL = 300000; // estimate gas usage of onOFTReceived()

    // packet type
    uint8 public constant PT_DEPOSIT_TO_REMOTE_CHAIN = 1;
    // ... other types

    // variables
    address public oft;
    mapping(uint16 => bytes) public remoteStakingContracts;
    mapping(address => uint) public balances;

    event Deposit(address from, uint amount);
    event Withdrawal(address to, uint amount);
    event DepositToDstChain(address from, uint16 dstChainId, bytes to, uint amountOut);

    constructor(address _oft) {
        oft = _oft;
    }

    function setRemoteStakingContract(uint16 _chainId, bytes calldata _stakingContract) external {
        remoteStakingContracts[_chainId] = _stakingContract;
    }

    function deposit(uint _amount) external payable {
        IERC20(oft).safeTransferFrom(msg.sender, address(this), _amount);
        balances[msg.sender] += _amount;
        emit Deposit(msg.sender, _amount);
    }

    function withdraw(uint _amount) external {
        withdraw(_amount, msg.sender);
    }

    function withdraw(uint _amount, address _to) public {
        require(balances[msg.sender] >= _amount);
        balances[msg.sender] -= _amount;
        IERC20(oft).safeTransfer(_to, _amount);
        emit Withdrawal(msg.sender, _amount);
    }

    function depositToDstChain(
        uint16 _dstChainId,
        bytes calldata _to, // address of the owner of token on the destination chain
        uint _amount, // amount of token to deposit
        bytes calldata _adapterParams
    ) external payable {
        bytes memory dstStakingContract = remoteStakingContracts[_dstChainId];
        require(keccak256(dstStakingContract) != keccak256(""), "invalid _dstChainId");

        bytes memory payload = abi.encode(PT_DEPOSIT_TO_REMOTE_CHAIN, _to);
        IComposableOFT(oft).sendAndCall{value: msg.value}(msg.sender, _dstChainId, dstStakingContract, _amount, payload, DST_GAS_FOR_CALL, payable(msg.sender), address(0), _adapterParams);

        emit DepositToDstChain(msg.sender, _dstChainId, _to, _amount);
    }

    function quoteForDeposit(
        uint16 _dstChainId,
        bytes calldata _to, // address of the owner of token on the destination chain
        uint _amount, // amount of token to deposit
        bytes calldata _adapterParams
    ) public view returns (uint nativeFee, uint zroFee) {
        bytes memory dstStakingContract = remoteStakingContracts[_dstChainId];
        require(keccak256(dstStakingContract) != keccak256(""), "invalid _dstChainId");

        bytes memory payload = abi.encode(PT_DEPOSIT_TO_REMOTE_CHAIN, _to);
        return IComposableOFT(oft).estimateSendAndCallFee(_dstChainId, dstStakingContract, _amount, payload, DST_GAS_FOR_CALL, false, _adapterParams);
    }

    //-----------------------------------------------------------------------------------------------------------------------
    function onOFTReceived(uint16 _srcChainId, bytes calldata, uint64, bytes calldata, uint _amount, bytes memory _payload) external override {
        require(msg.sender == oft, "only oft can call onOFTReceived()");

        uint8 pkType;
        assembly {
            pkType := mload(add(_payload, 32))
        }

        if (pkType == PT_DEPOSIT_TO_REMOTE_CHAIN) {
            (, bytes memory toAddrBytes) = abi.decode(_payload, (uint8, bytes));

            address to = toAddrBytes.toAddress(0);
            balances[to] += _amount;
        } else {
            revert("invalid deposit type");
        }
    }

    function tryOnOFTReceived(uint16 _srcChainId, bytes calldata _srcAddress, uint64, bytes calldata, uint, bytes memory _payload) external view override {
        require(msg.sender == oft, "only oft can call onOFTReceived()");
        require(keccak256(remoteStakingContracts[_srcChainId]) == keccak256(_srcAddress), "invalid _srcAddress");

        uint8 pkType;
        assembly {
            pkType := mload(add(_payload, 32))
        }

        if (pkType == PT_DEPOSIT_TO_REMOTE_CHAIN) {
            (, bytes memory toAddrBytes) = abi.decode(_payload, (uint8, bytes));
            toAddrBytes.toAddress(0);
        } else {
            revert("invalid deposit type");
        }
    }
}
