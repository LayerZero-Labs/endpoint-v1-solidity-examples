// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma abicoder v2;

import "../interfaces/IStargateRouter.sol";

interface IStargateWidget {
    struct FeeObj {
        uint256 tenthBps; // bps is to an extra decimal place
        address feeCollector;
    }

    event WidgetSwapped(bytes2 indexed partnerId, uint256 tenthBps, uint256 widgetFee);
    event PartnerSwap(bytes2 indexed partnerId);

    function partnerSwap(bytes2 _partnerId) external;

    function swapTokens(
        uint16 _dstChainId,
        uint16 _srcPoolId,
        uint16 _dstPoolId,
        uint256 _amountLD,
        uint256 _minAmountLD,
        IStargateRouter.lzTxObj calldata _lzTxParams,
        bytes calldata _to,
        bytes2 _partnerId,
        FeeObj calldata _feeObj
    ) external payable;


    function swapETH(
        uint16 _dstChainId,
        uint256 _amountLD,
        uint256 _minAmountLD,
        bytes calldata _to,
        bytes2 _partnerId,
        FeeObj calldata _feeObj
    ) external payable;
}
