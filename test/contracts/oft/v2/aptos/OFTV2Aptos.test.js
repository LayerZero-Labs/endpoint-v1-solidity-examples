const { expect } = require("chai")
const { ethers } = require("hardhat")
const { utils, constants, BigNumber } = require("ethers")

describe("OFTv2 Aptos", () => {
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

    const name = "OFT"
    const symbol = "OFT"

    let owner, ownerAddressBytes32
    let endpointFactory
    let localEndpoint, remoteEndpoint
    let oftFactory, oftAptosFactory
    let oft, oftAptos
    let lzCallParams

    before(async () => {
        [owner] = await ethers.getSigners()
        ownerAddressBytes32 = utils.defaultAbiCoder.encode(["address"], [owner.address])
        endpointFactory = await ethers.getContractFactory("LZEndpointMock")
        oftFactory = await ethers.getContractFactory("OFTV2MintableMock")
        oftAptosFactory = await ethers.getContractFactory("OFTV2AptosMintableMock")
        lzCallParams = [owner.address, constants.AddressZero, "0x"]
    })

    beforeEach(async () => {
        localEndpoint = await endpointFactory.deploy(localChainId)
        remoteEndpoint = await endpointFactory.deploy(remoteChainId)

        oftAptos = await oftAptosFactory.deploy(name, symbol, aptosSharedDecimals, localEndpoint.address)
        oft = await oftFactory.deploy(name, symbol, aptosSharedDecimals, remoteEndpoint.address)

        // internal bookkeeping for endpoints (not part of a real deploy, just for this test)
        await localEndpoint.setDestLzEndpoint(oft.address, remoteEndpoint.address)
        await remoteEndpoint.setDestLzEndpoint(oftAptos.address, localEndpoint.address)

        // set each contracts source address so it can send to each other
        await oftAptos.setTrustedRemoteAddress(remoteChainId, oft.address)
        await oft.setTrustedRemoteAddress(localChainId, oftAptos.address)

        await oftAptos.mint(owner.address, constants.MaxUint256)
        await oft.mint(owner.address, constants.MaxUint256)
    })

    describe("constructor()", () => {
        it("OFTv2Aptos reverts when passing more than 6 shared decimals in constructor", async () => {
            await expect(oftAptosFactory.deploy(name, symbol, aptosSharedDecimals + 1, localEndpoint.address)).to.be.revertedWith(
                "OFTV2Aptos: shared decimals exceed maximum allowed"
            )
        })

        it("OFTv2 doesn't revert when passing more than 6 shared decimals in constructor", async () => {
            await expect(oftFactory.deploy(name, symbol, aptosSharedDecimals + 1, localEndpoint.address)).to.not.be.reverted
        })
    })

    describe("sendFrom()", () => {
        it("OFTv2Aptos reverts when sending amount is greater than uint64.max", async () => {
            await expect(
                oftAptos.sendFrom(owner.address, remoteChainId, ownerAddressBytes32, greaterThanMaxAmount, lzCallParams, { value: nativeFee })
            ).to.be.revertedWith("OFTV2Aptos: amountSD overflow")
        })

        it("OFTv2 doesn't revert when sending amount is greater than uint64.max", async () => {
            await expect(
                oft.sendFrom(owner.address, localChainId, ownerAddressBytes32, greaterThanMaxAmount, lzCallParams, { value: nativeFee })
            ).to.not.be.reverted
        })

        it("OFTv2Aptos doesn't revert when sending amount is less than or equal to uint64.max", async () => {
            await expect(oftAptos.sendFrom(owner.address, remoteChainId, ownerAddressBytes32, maxAmount, lzCallParams, { value: nativeFee })).to
                .not.be.reverted
        })
    })

    describe("sendAndCall()", () => {
        it("OFTv2Aptos reverts when sending amount is greater than uint64.max", async () => {
            await expect(
                oftAptos.sendAndCall(
                    owner.address,
                    remoteChainId,
                    ownerAddressBytes32,
                    greaterThanMaxAmount,
                    callPayload,
                    dstGasForCall,
                    lzCallParams,
                    { value: nativeFee }
                )
            ).to.be.revertedWith("OFTV2Aptos: amountSD overflow")
        })

        it("OFTv2 doesn't revert when sending amount is greater than uint64.max", async () => {
            await expect(
                oft.sendAndCall(
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

        it("OFTv2Aptos doesn't revert when sending amount is less than or equal to uint64.max", async () => {
            await expect(
                oftAptos.sendAndCall(owner.address, remoteChainId, ownerAddressBytes32, maxAmount, callPayload, dstGasForCall, lzCallParams, {
                    value: nativeFee,
                })
            ).to.not.be.reverted
        })
    })
})