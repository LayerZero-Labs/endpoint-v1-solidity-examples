const { expect } = require("chai")
const { ethers } = require("hardhat")
const { utils, constants, BigNumber } = require("ethers")

describe("Proxy OFTv2 Aptos", () => {
    const localChainId = 1
    const remoteChainId = 2
    const aptosSharedDecimals = 6
    const maxUint64 = BigNumber.from(2).pow(64).sub(1)
    const ld2sdRate = BigNumber.from(10).pow(18 - aptosSharedDecimals)
    const maxAmount = maxUint64.mul(ld2sdRate)
    const greaterThanMaxAmount = maxUint64.add(1).mul(ld2sdRate)

    const nativeFee = utils.parseEther("0.1")
    const dstGasForCall = 100000
    const callPayload = "0x"

    let owner, ownerAddressBytes32
    let endpointFactory
    let localEndpoint, remoteEndpoint
    let proxyOftFactory, proxyOftAptosFactory
    let proxyOft, proxyOftAptos
    let erc20Factory
    let erc20
    let lzCallParams

    before(async () => {
        [owner] = await ethers.getSigners()
        ownerAddressBytes32 = utils.defaultAbiCoder.encode(["address"], [owner.address])
        endpointFactory = await ethers.getContractFactory("LZEndpointMock")
        proxyOftFactory = await ethers.getContractFactory("ProxyOFTV2")
        proxyOftAptosFactory = await ethers.getContractFactory("ProxyOFTV2Aptos")
        erc20Factory = await ethers.getContractFactory("ERC20Mock")
        lzCallParams = [owner.address, constants.AddressZero, "0x"]
    })

    beforeEach(async () => {
        localEndpoint = await endpointFactory.deploy(localChainId)
        remoteEndpoint = await endpointFactory.deploy(remoteChainId)

        erc20 = await erc20Factory.deploy("ERC20 Mock", "MOCK")
        proxyOftAptos = await proxyOftAptosFactory.deploy(erc20.address, aptosSharedDecimals, localEndpoint.address)
        proxyOft = await proxyOftFactory.deploy(erc20.address, aptosSharedDecimals, remoteEndpoint.address)

        // internal bookkeeping for endpoints (not part of a real deploy, just for this test)
        await localEndpoint.setDestLzEndpoint(proxyOft.address, remoteEndpoint.address)
        await remoteEndpoint.setDestLzEndpoint(proxyOftAptos.address, localEndpoint.address)

        // set each contracts source address so it can send to each other
        await proxyOftAptos.setTrustedRemoteAddress(remoteChainId, proxyOft.address)
        await proxyOft.setTrustedRemoteAddress(localChainId, proxyOftAptos.address)

        await erc20.mint(owner.address, constants.MaxUint256)
        await erc20.approve(proxyOftAptos.address, constants.MaxInt256)
        await erc20.approve(proxyOft.address, constants.MaxInt256)
    })

    describe("constructor()", () => {
        it("ProxyOFTv2Aptos reverts when passing more than 6 shared decimals in constructor", async () => {
            await expect(proxyOftAptosFactory.deploy(erc20.address, aptosSharedDecimals + 1, localEndpoint.address)).to.be.revertedWith(
                "ProxyOFTV2Aptos: shared decimals exceed maximum allowed"
            )
        })

        it("ProxyOFTv2 doesn't revert when passing more than 6 shared decimals passed in constructor", async () => {
            await expect(proxyOftFactory.deploy(erc20.address, aptosSharedDecimals + 1, localEndpoint.address)).to.not.be.reverted
        })
    })

    describe("sendFrom()", () => {
        it("ProxyOFTv2Aptos reverts when sending amount is greater than uint64.max", async () => {
            await expect(
                proxyOftAptos.sendFrom(owner.address, remoteChainId, ownerAddressBytes32, greaterThanMaxAmount, lzCallParams, {
                    value: nativeFee,
                })
            ).to.be.revertedWith("ProxyOFTV2Aptos: outboundAmount overflow")
        })

        it("ProxyOFTv2 doesn't revert when sending amount is greater than uint64.max", async () => {
            await expect(
                proxyOft.sendFrom(owner.address, localChainId, ownerAddressBytes32, greaterThanMaxAmount, lzCallParams, { value: nativeFee })
            ).to.not.be.reverted
        })

        it("ProxyOFTv2Aptos doesn't revert when sending amount is less than or equal to uint64.max", async () => {
            await expect(
                proxyOftAptos.sendFrom(owner.address, remoteChainId, ownerAddressBytes32, maxAmount, lzCallParams, { value: nativeFee })
            ).to.not.be.reverted
        })
    })

    describe("sendAndCall()", () => {
        it("ProxyOFTv2Aptos reverts when sending amount is greater than uint64.max", async () => {
            await expect(
                proxyOftAptos.sendAndCall(
                    owner.address,
                    remoteChainId,
                    ownerAddressBytes32,
                    greaterThanMaxAmount,
                    callPayload,
                    dstGasForCall,
                    lzCallParams,
                    { value: nativeFee }
                )
            ).to.be.revertedWith("ProxyOFTV2Aptos: outboundAmount overflow")
        })

        it("ProxyOFTv2 doesn't revert when sending amount is greater than uint64.max", async () => {
            await expect(
                proxyOft.sendAndCall(
                    owner.address,
                    localChainId,
                    ownerAddressBytes32,
                    greaterThanMaxAmount,
                    callPayload,
                    dstGasForCall,
                    lzCallParams,
                    { value: nativeFee }
                )
            ).to.not.be.reverted
        })

        it("ProxyOFTv2Aptos doesn't revert when sending amount is less than or equal to uint64.max", async () => {
            await expect(
                proxyOftAptos.sendAndCall(
                    owner.address,
                    remoteChainId,
                    ownerAddressBytes32,
                    maxAmount,
                    callPayload,
                    dstGasForCall,
                    lzCallParams,
                    { value: nativeFee }
                )
            ).to.not.be.reverted
        })
    })
})