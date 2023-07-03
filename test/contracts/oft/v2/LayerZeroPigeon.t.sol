// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "forge-std/Test.sol";
import { LayerZeroHelper } from "pigeon/layerzero/LayerZeroHelper.sol";
import { ExampleOFTV2 } from "../../../../contracts/examples/ExampleOFTV2.sol";
import "../../../../contracts/token/oft/v2/ICommonOFT.sol";
import "../../../../contracts/interfaces/ILayerZeroEndpoint.sol";

contract LayerZeroPigeonTest is Test {
    // LayerZero Ids
    uint16 constant ETH_ID = 101;
    uint16 constant GOERLI_ID = 10_121;
    uint16 constant POLYGON_ID = 109;
    uint16 constant ARBITRUM_ID = 110;
    
    LayerZeroHelper lzHelper;
    ExampleOFTV2 public polyMevEth;
    ExampleOFTV2 public arbMevEth;

    uint256 POLYGON_FORK_ID;
    uint256 ARBITRUM_FORK_ID;

    address constant L1_lzEndpoint = 0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675;
    address constant polygonEndpoint = 0x3c2269811836af69497E5F486A85D7316753cf62;
    address constant arbitrumEndpoint = 0x3c2269811836af69497E5F486A85D7316753cf62;

    address[] public allDstTargets;
    address[] public allDstEndpoints;
    uint16[] public allDstChainIds;
    uint256[] public allDstForks;

    string RPC_ETH_MAINNET = vm.envString("ETH_MAINNET_RPC_URL");
    string RPC_POLYGON_MAINNET = vm.envString("POLYGON_MAINNET_RPC_URL");
    string RPC_ARBITRUM_MAINNET = vm.envString("ARBITRUM_MAINNET_RPC_URL");

    address gov;
    uint initSupply;

    function setUp() public {
        gov = address(this);
        initSupply = 2_000_000 ether;
        uint8 sharedDecimals = 8;
        POLYGON_FORK_ID = vm.createSelectFork(RPC_POLYGON_MAINNET);
        lzHelper = new LayerZeroHelper();

        // deploy mevEth (polygon)
        polyMevEth = new ExampleOFTV2(address(polygonEndpoint), initSupply, sharedDecimals);

        ARBITRUM_FORK_ID = vm.createSelectFork(RPC_ARBITRUM_MAINNET);
        arbMevEth = new ExampleOFTV2(address(arbitrumEndpoint), 0, sharedDecimals);

        // set trusted remotes
        arbMevEth.setTrustedRemote(POLYGON_ID, abi.encodePacked(address(polyMevEth), address(arbMevEth)));

        vm.selectFork(POLYGON_FORK_ID);
        polyMevEth.setTrustedRemote(ARBITRUM_ID, abi.encodePacked(address(arbMevEth), address(polyMevEth)));
    }

    /// @notice test send mevEth token cross chain through mock lz endpoint
    function testSendFromPigeon() public {
        vm.selectFork(POLYGON_FORK_ID);
        address User02 = address(2);
        uint256 amount = 1 ether;
        
        vm.startPrank(gov);

        // Check the user has init supply        
        assertEq(polyMevEth.balanceOf(gov), initSupply);

        // Check that the mevETH contract has initSupply
        assertEq(polyMevEth.totalSupply(), initSupply);

        // setup call params
        ICommonOFT.LzCallParams memory callParams;
        callParams.refundAddress = payable(gov);
        callParams.zroPaymentAddress = address(0);
        callParams.adapterParams = "";
        // call estimate send fee
        (uint256 nativeFee,) = polyMevEth.estimateSendFee(ARBITRUM_ID, _addressToBytes32(User02), amount, false, "");

        vm.recordLogs();
        // send tokens from mainnet to simulated arbitrum
        polyMevEth.sendFrom{ value: nativeFee }(gov, ARBITRUM_ID, _addressToBytes32(User02), amount, callParams);
        vm.stopPrank();
        Vm.Log[] memory logs = vm.getRecordedLogs();
        lzHelper.help(arbitrumEndpoint, 100_000, ARBITRUM_FORK_ID, logs);

        vm.selectFork(ARBITRUM_FORK_ID);
        assertEq(arbMevEth.totalSupply(), amount);
        assertEq(arbMevEth.balanceOf(User02), amount);
    }

    function _addressToBytes32(address _address) internal pure virtual returns (bytes32) {
        return bytes32(uint256(uint160(_address)));
    }
}
