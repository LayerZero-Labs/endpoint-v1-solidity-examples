const { expect } = require("chai")
const { ethers } = require("hardhat")
const { BigNumber } = require("@ethersproject/bignumber")

describe("OFT with fee: ", function () {
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
        ProxyOFTV2 = await ethers.getContractFactory("ProxyOFTWithFee")
        OFTV2 = await ethers.getContractFactory("OFTWithFee")
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
        await localOFT.setTrustedRemote(remoteChainId, remotePath) // for A, set B
        await remoteOFT.setTrustedRemote(localChainId, localPath) // for B, set A

        await localOFT.setMinDstGas(remoteChainId, 0, 200000)
        await localOFT.setMinDstGas(remoteChainId, 1, 200000)
        await remoteOFT.setMinDstGas(localChainId, 0, 200000)
        await remoteOFT.setMinDstGas(localChainId, 1, 200000)
    })

    it("send tokens from proxy oft and receive them back", async function () {
        const amount = ethers.utils.parseEther("1") // 1 ether
        await erc20.mint(alice.address, amount)

        // verify alice has tokens and bob has no tokens on remote chain
        expect(await erc20.balanceOf(alice.address)).to.be.equal(amount)
        expect(await remoteOFT.balanceOf(bob.address)).to.be.equal(0)

        // alice sends tokens to bob on remote chain
        // approve the proxy to swap your tokens
        await erc20.connect(alice).approve(localOFT.address, amount)

        // swaps token to remote chain
        const bobAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [bob.address])
        let nativeFee = (await localOFT.estimateSendFee(remoteChainId, bobAddressBytes32, amount, false, defaultAdapterParams)).nativeFee
        await localOFT
            .connect(alice)
            .sendFrom(
                alice.address,
                remoteChainId,
                bobAddressBytes32,
                amount,
                amount,
                [alice.address, ethers.constants.AddressZero, defaultAdapterParams],
                { value: nativeFee }
            )

        // tokens are now owned by the proxy contract, because this is the original oft chain
        expect(await erc20.balanceOf(localOFT.address)).to.equal(amount)
        expect(await erc20.balanceOf(alice.address)).to.equal(0)

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
                halfAmount,
                [bob.address, ethers.constants.AddressZero, defaultAdapterParams],
                { value: nativeFee }
            )

        // half tokens are burned on the remote chain
        expect(await remoteOFT.totalSupply()).to.equal(halfAmount)
        expect(await remoteOFT.balanceOf(bob.address)).to.be.equal(halfAmount)

        // tokens received on the local chain and unlocked from the proxy
        expect(await erc20.balanceOf(localOFT.address)).to.be.equal(halfAmount)
        expect(await erc20.balanceOf(alice.address)).to.be.equal(halfAmount)
    })

    it("quote oft fee", async function () {
        // default fee 0%
        expect(await localOFT.quoteOFTFee(1, 10000)).to.be.equal(0)

        // change default fee to 10%
        await localOFT.setDefaultFeeBp(1000)
        expect(await localOFT.quoteOFTFee(1, 10000)).to.be.equal(1000)

        // change fee to 20% for chain 2
        await localOFT.setFeeBp(2, true, 2000)
        expect(await localOFT.quoteOFTFee(1, 10000)).to.be.equal(1000)
        expect(await localOFT.quoteOFTFee(2, 10000)).to.be.equal(2000)

        // change fee to 0% for chain 2
        await localOFT.setFeeBp(2, true, 0)
        expect(await localOFT.quoteOFTFee(1, 10000)).to.be.equal(1000)
        expect(await localOFT.quoteOFTFee(2, 10000)).to.be.equal(0)

        // disable fee for chain 2
        await localOFT.setFeeBp(2, false, 0)
        expect(await localOFT.quoteOFTFee(1, 10000)).to.be.equal(1000)
        expect(await localOFT.quoteOFTFee(2, 10000)).to.be.equal(1000)
    })

    it("charge oft fee for sending", async function () {
        const amount = ethers.utils.parseEther("1") // 1 ether
        const halfAmount = amount.div(2)

        await erc20.mint(alice.address, amount)

        // set default fee to 50%
        await localOFT.setDefaultFeeBp(5000)

        // swaps max amount of token to remote chain
        const bobAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [bob.address])
        await erc20.connect(alice).approve(localOFT.address, amount)
        let nativeFee = (await localOFT.estimateSendFee(remoteChainId, bobAddressBytes32, amount, false, defaultAdapterParams)).nativeFee
        try {
            await localOFT
                .connect(alice)
                .sendFrom(
                    alice.address,
                    remoteChainId,
                    bobAddressBytes32,
                    amount,
                    amount,
                    [alice.address, ethers.constants.AddressZero, defaultAdapterParams],
                    { value: nativeFee }
                )
            expect(false).to.be.true
        } catch (e) {
            expect(e.message).to.match(/BaseOFTWithFee: amount is less than minAmount/)
        }

        await localOFT
            .connect(alice)
            .sendFrom(
                alice.address,
                remoteChainId,
                bobAddressBytes32,
                amount,
                halfAmount,
                [alice.address, ethers.constants.AddressZero, defaultAdapterParams],
                { value: nativeFee }
            )

        expect(await remoteOFT.balanceOf(bob.address)).to.be.equal(halfAmount)
        expect(await erc20.balanceOf(owner.address)).to.be.equal(halfAmount) // half tokens are fee
        expect(await erc20.balanceOf(alice.address)).to.be.equal(0)
    })
})
