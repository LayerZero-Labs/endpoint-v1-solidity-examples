const { expect } = require("chai")
const { ethers } = require("hardhat")
const { BigNumber } = require("@ethersproject/bignumber")

describe("OFT v2: ", function () {
    const localChainId = 1
    const remoteChainId = 2
    const name = "OmnichainFungibleToken"
    const symbol = "OFT"
    const sharedDecimals = 5
    // const globalSupply = ethers.utils.parseUnits("1000000", 18)

    let LZEndpointMock, ERC20, ProxyOFTV2, OFTV2
    let localEndpoint, remoteEndpoint, localOFT, remoteOFT, erc20, remotePath, localPath
    let owner, alice, bob

    let defaultAdapterParams = ethers.utils.solidityPack(["uint16", "uint256"], [1, 200000])

    before(async function () {
        LZEndpointMock = await ethers.getContractFactory("LZEndpointMock")
        ProxyOFTV2 = await ethers.getContractFactory("ProxyOFTV2")
        OFTV2 = await ethers.getContractFactory("OFTV2")
        ERC20 = await ethers.getContractFactory("ERC20Mock")
        owner = (await ethers.getSigners())[0]
        alice = (await ethers.getSigners())[1]
        bob = (await ethers.getSigners())[2]
    })

    beforeEach(async function () {
        localEndpoint = await LZEndpointMock.deploy(localChainId)
        remoteEndpoint = await LZEndpointMock.deploy(remoteChainId)

        // create two OmnichainFungibleToken instances
        erc20 = await ERC20.deploy("ERC20", "ERC20")
        localOFT = await ProxyOFTV2.deploy(erc20.address, sharedDecimals, localEndpoint.address)
        remoteOFT = await OFTV2.deploy(name, symbol, sharedDecimals, remoteEndpoint.address)

        // internal bookkeeping for endpoints (not part of a real deploy, just for this test)
        await localEndpoint.setDestLzEndpoint(remoteOFT.address, remoteEndpoint.address)
        await remoteEndpoint.setDestLzEndpoint(localOFT.address, localEndpoint.address)

        // set each contracts source address so it can send to each other
        remotePath = ethers.utils.solidityPack(["address", "address"], [remoteOFT.address, localOFT.address])
        localPath = ethers.utils.solidityPack(["address", "address"], [localOFT.address, remoteOFT.address])

        await localOFT.setMinDstGas(remoteChainId, 0, 200000)
        await localOFT.setMinDstGas(remoteChainId, 1, 200000)
        await remoteOFT.setMinDstGas(localChainId, 0, 200000)
        await remoteOFT.setMinDstGas(localChainId, 1, 200000)

        await localOFT.setTrustedRemote(remoteChainId, remotePath) // for A, set B
        await remoteOFT.setTrustedRemote(localChainId, localPath) // for B, set A
    })

    it("send tokens from proxy oft and receive them back", async function () {
        const initialAmount = ethers.utils.parseEther("1.00000001") // 1 ether
        const amount = ethers.utils.parseEther("1.00000000")
        const dust = ethers.utils.parseEther("0.00000001")
        await erc20.mint(alice.address, initialAmount)

        // verify alice has tokens and bob has no tokens on remote chain
        expect(await erc20.balanceOf(alice.address)).to.be.equal(initialAmount)
        expect(await remoteOFT.balanceOf(bob.address)).to.be.equal(0)

        // alice sends tokens to bob on remote chain
        // approve the proxy to swap your tokens
        await erc20.connect(alice).approve(localOFT.address, initialAmount)

        // swaps token to remote chain
        const bobAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [bob.address])
        let nativeFee = (await localOFT.estimateSendFee(remoteChainId, bobAddressBytes32, initialAmount, false, defaultAdapterParams)).nativeFee
        await localOFT
            .connect(alice)
            .sendFrom(
                alice.address,
                remoteChainId,
                bobAddressBytes32,
                initialAmount,
                [alice.address, ethers.constants.AddressZero, defaultAdapterParams],
                { value: nativeFee }
            )

        // tokens are now owned by the proxy contract, because this is the original oft chain
        expect(await erc20.balanceOf(localOFT.address)).to.equal(amount)
        expect(await erc20.balanceOf(alice.address)).to.equal(dust)

        // tokens received on the remote chain
        expect(await remoteOFT.totalSupply()).to.equal(amount)
        expect(await remoteOFT.balanceOf(bob.address)).to.be.equal(amount)

        // bob send tokens back to alice from remote chain
        const aliceAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [alice.address])
        const halfAmount = amount.div(2)
        nativeFee = (await remoteOFT.estimateSendFee(localChainId, aliceAddressBytes32, halfAmount, false, defaultAdapterParams)).nativeFee
        await remoteOFT
            .connect(bob)
            .sendFrom(
                bob.address,
                localChainId,
                aliceAddressBytes32,
                halfAmount,
                [bob.address, ethers.constants.AddressZero, defaultAdapterParams],
                { value: nativeFee }
            )

        // half tokens are burned on the remote chain
        expect(await remoteOFT.totalSupply()).to.equal(halfAmount)
        expect(await remoteOFT.balanceOf(bob.address)).to.be.equal(halfAmount)

        // tokens received on the local chain and unlocked from the proxy
        expect(await erc20.balanceOf(localOFT.address)).to.be.equal(halfAmount)
        // console.log(halfAmount, dust, typeof halfAmount, typeof dust)
        // console.log(halfAmount.add(dust), typeof halfAmount.add(dust))
        expect(await erc20.balanceOf(alice.address)).to.be.equal(halfAmount.add(dust))
    })

    it("total outbound amount overflow", async function () {
        // alice try sending a huge amount of tokens to bob on remote chain
        await erc20.mint(alice.address, ethers.constants.MaxUint256)

        const maxUint64 = BigNumber.from(2).pow(64).sub(1)
        let amount = maxUint64.mul(BigNumber.from(10).pow(18 - sharedDecimals)) // sd to ld

        // swaps max amount of token to remote chain
        await erc20.connect(alice).approve(localOFT.address, ethers.constants.MaxUint256)
        const bobAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [bob.address])
        let nativeFee = (await localOFT.estimateSendFee(remoteChainId, bobAddressBytes32, amount, false, defaultAdapterParams)).nativeFee
        await localOFT
            .connect(alice)
            .sendFrom(
                alice.address,
                remoteChainId,
                bobAddressBytes32,
                amount,
                [alice.address, ethers.constants.AddressZero, defaultAdapterParams],
                { value: nativeFee }
            )

        amount = BigNumber.from(10).pow(18 - sharedDecimals) // min amount without dust

        // fails to send more for cap overflow
        nativeFee = (await localOFT.estimateSendFee(remoteChainId, bobAddressBytes32, amount, false, defaultAdapterParams)).nativeFee

        try {
            await localOFT
                .connect(alice)
                .sendFrom(
                    alice.address,
                    remoteChainId,
                    bobAddressBytes32,
                    amount,
                    [alice.address, ethers.constants.AddressZero, defaultAdapterParams],
                    { value: nativeFee }
                )
            expect(false).to.be.true
        } catch (e) {
            expect(e.message).to.match(/ProxyOFT: outboundAmount overflow/)
        }
    })
})
