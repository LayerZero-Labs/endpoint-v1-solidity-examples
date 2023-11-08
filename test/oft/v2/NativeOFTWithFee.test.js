const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("NativeOFTWithFee: ", function () {
    const localChainId = 1
    const remoteChainId = 2
    const name = "NativeOFTWithFee"
    const symbol = "NOFT"
    const sharedDecimals = 6

    let owner,
        alice,
        bob,
        localEndpoint,
        remoteEndpoint,
        nativeOFTWithFee,
        remoteOFTWithFee,
        LZEndpointMock,
        NativeOFTWithFee,
        OFTWithFee,
        ownerAddressBytes32

    let defaultAdapterParams = ethers.utils.solidityPack(["uint16", "uint256"], [1, 200000])

    before(async function () {
        ;[owner, alice, bob] = await ethers.getSigners()
        LZEndpointMock = await ethers.getContractFactory("LZEndpointMock")
        NativeOFTWithFee = await ethers.getContractFactory("NativeOFTWithFee")
        OFTWithFee = await ethers.getContractFactory("OFTWithFee")
    })

    beforeEach(async function () {
        localEndpoint = await LZEndpointMock.deploy(localChainId)
        remoteEndpoint = await LZEndpointMock.deploy(remoteChainId)

        //------  deploy: base & other chain  -------------------------------------------------------
        // create two NativeOFTWithFee instances. both tokens have the same name and symbol on each chain
        // 1. base chain
        // 2. other chain
        nativeOFTWithFee = await NativeOFTWithFee.deploy(name, symbol, sharedDecimals, localEndpoint.address)
        remoteOFTWithFee = await OFTWithFee.deploy(name, symbol, sharedDecimals, remoteEndpoint.address)

        // internal bookkeeping for endpoints (not part of a real deploy, just for this test)
        await localEndpoint.setDestLzEndpoint(remoteOFTWithFee.address, remoteEndpoint.address)
        await remoteEndpoint.setDestLzEndpoint(nativeOFTWithFee.address, localEndpoint.address)

        //------  setTrustedRemote(s) -------------------------------------------------------
        // for each OFTV2, setTrustedRemote to allow it to receive from the remote OFTV2 contract.
        // Note: This is sometimes referred to as the "wire-up" process.
        // set each contracts source address so it can send to each other
        await nativeOFTWithFee.setTrustedRemoteAddress(remoteChainId, remoteOFTWithFee.address)
        await remoteOFTWithFee.setTrustedRemoteAddress(localChainId, nativeOFTWithFee.address)

        await nativeOFTWithFee.setMinDstGas(remoteChainId, 0, 200000)
        await nativeOFTWithFee.setMinDstGas(remoteChainId, 1, 200000)
        await remoteOFTWithFee.setMinDstGas(localChainId, 0, 200000)
        await remoteOFTWithFee.setMinDstGas(localChainId, 1, 200000)

        ownerAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [owner.address])
    })

    it("sendFrom() - tokens from main to other chain using default", async function () {
        expect(await ethers.provider.getBalance(localEndpoint.address)).to.be.equal(ethers.utils.parseEther("0"))

        // ensure they're both allocated initial amounts
        let aliceBalance = await ethers.provider.getBalance(alice.address)
        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.equal(0)
        expect(await remoteOFTWithFee.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFTWithFee.address)).to.equal(0)

        let depositAmount = ethers.utils.parseEther("7")
        await nativeOFTWithFee.deposit({ value: depositAmount })

        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFTWithFee.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseEther("0")
        let totalAmount = ethers.utils.parseEther("8")

        // estimate nativeFees
        let nativeFee = (await nativeOFTWithFee.estimateSendFee(remoteChainId, ownerAddressBytes32, totalAmount, false, defaultAdapterParams))
            .nativeFee
        expect(await ethers.provider.getBalance(localEndpoint.address)).to.be.equal(ethers.utils.parseEther("0"))
        await nativeOFTWithFee.sendFrom(
            owner.address,
            remoteChainId, // destination chainId
            ownerAddressBytes32, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            totalAmount, // quantity of tokens to send (in units of wei)
            [owner.address, ethers.constants.AddressZero, defaultAdapterParams],
            { value: nativeFee.add(totalAmount.sub(depositAmount)) } // pass a msg.value to pay the LayerZero message fee
        )

        // expect(await ethers.provider.getBalance(owner.address)).to.be.equal(ownerBalance.sub(messageFee).sub(transFee).sub(depositAmount))
        expect(await ethers.provider.getBalance(nativeOFTWithFee.address)).to.be.equal(totalAmount)
        expect(await ethers.provider.getBalance(localEndpoint.address)).to.be.equal(nativeFee) // collects
        expect(await nativeOFTWithFee.balanceOf(nativeOFTWithFee.address)).to.be.equal(totalAmount)
        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.be.equal(leftOverAmount)
        expect(await remoteOFTWithFee.balanceOf(owner.address)).to.be.equal(totalAmount)
        expect(await nativeOFTWithFee.outboundAmount()).to.be.equal(totalAmount)
        expect(await remoteOFTWithFee.totalSupply()).to.be.equal(totalAmount)

        let ownerBalance2 = await ethers.provider.getBalance(owner.address)

        const aliceAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [alice.address])
        // estimate nativeFees
        nativeFee = (await nativeOFTWithFee.estimateSendFee(localChainId, aliceAddressBytes32, totalAmount, false, defaultAdapterParams))
            .nativeFee
        await remoteOFTWithFee.sendFrom(
            owner.address,
            localChainId, // destination chainId
            aliceAddressBytes32, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            totalAmount, // quantity of tokens to send (in units of wei)
            [owner.address, ethers.constants.AddressZero, defaultAdapterParams],
            { value: nativeFee.add(totalAmount) } // pass a msg.value to pay the LayerZero message fee
        )

        let transFee = ownerBalance2.sub(await ethers.provider.getBalance(owner.address)).sub(nativeFee)
        expect(await ethers.provider.getBalance(alice.address)).to.be.equal(aliceBalance.add(totalAmount))
        expect(await ethers.provider.getBalance(owner.address)).to.be.equal(ownerBalance2.sub(nativeFee).sub(transFee))
        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.equal(leftOverAmount)
        expect(await remoteOFTWithFee.balanceOf(owner.address)).to.equal(0)
        expect(await nativeOFTWithFee.outboundAmount()).to.be.equal(leftOverAmount)
        expect(await remoteOFTWithFee.totalSupply()).to.be.equal(leftOverAmount)
    })

    it("sendFrom() w/ fee change - tokens from main to other chain", async function () {
        expect(await ethers.provider.getBalance(localEndpoint.address)).to.be.equal(ethers.utils.parseEther("0"))

        // set default fee to 0.01%
        await nativeOFTWithFee.setDefaultFeeBp(1)
        await nativeOFTWithFee.setFeeOwner(bob.address)

        // ensure they're both allocated initial amounts
        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.equal(0)
        expect(await remoteOFTWithFee.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFTWithFee.address)).to.equal(0)

        let leftOverAmount = ethers.utils.parseEther("0")
        let totalAmount = ethers.utils.parseEther("8")

        expect(await ethers.provider.getBalance(localEndpoint.address)).to.be.equal(0)
        expect(await nativeOFTWithFee.balanceOf(nativeOFTWithFee.address)).to.be.equal(0)
        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.be.equal(0)
        expect(await remoteOFTWithFee.balanceOf(owner.address)).to.be.equal(0)

        const aliceAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [alice.address])
        // estimate nativeFees
        let fee = await nativeOFTWithFee.quoteOFTFee(remoteChainId, totalAmount)
        let nativeFee = (await nativeOFTWithFee.estimateSendFee(remoteChainId, aliceAddressBytes32, totalAmount, false, defaultAdapterParams))
            .nativeFee
        await nativeOFTWithFee.sendFrom(
            owner.address,
            remoteChainId, // destination chainId
            aliceAddressBytes32, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            totalAmount.sub(fee), // quantity of tokens to send (in units of wei)
            [owner.address, ethers.constants.AddressZero, defaultAdapterParams],
            { value: nativeFee.add(totalAmount) } // pass a msg.value to pay the LayerZero message fee
        )
        expect(await ethers.provider.getBalance(localEndpoint.address)).to.be.equal(nativeFee) // collects
        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.be.equal(leftOverAmount)
        expect(await nativeOFTWithFee.balanceOf(alice.address)).to.be.equal(leftOverAmount)
        expect(await nativeOFTWithFee.balanceOf(bob.address)).to.be.equal(fee)
        expect(await nativeOFTWithFee.balanceOf(nativeOFTWithFee.address)).to.be.equal(totalAmount.sub(fee))
        expect(await nativeOFTWithFee.outboundAmount()).to.be.equal(totalAmount.sub(fee))
        expect(await remoteOFTWithFee.totalSupply()).to.be.equal(totalAmount.sub(fee))
    })

    it("sendFrom() w/ fee change - tokens from main to other chain without taking dust", async function () {
        expect(await ethers.provider.getBalance(localEndpoint.address)).to.be.equal(ethers.utils.parseEther("0"))

        // set default fee to 50%
        await nativeOFTWithFee.setDefaultFeeBp(1)
        await nativeOFTWithFee.setFeeOwner(bob.address)

        // ensure they're both allocated initial amounts
        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.equal(0)
        expect(await remoteOFTWithFee.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFTWithFee.address)).to.equal(0)

        let leftOverAmount = ethers.utils.parseEther("0")
        let totalAmount = ethers.utils.parseEther("8.123456789")

        expect(await ethers.provider.getBalance(localEndpoint.address)).to.be.equal(0)
        expect(await nativeOFTWithFee.balanceOf(nativeOFTWithFee.address)).to.be.equal(0)
        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.be.equal(0)
        expect(await remoteOFTWithFee.balanceOf(owner.address)).to.be.equal(0)

        const aliceAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [alice.address])
        // estimate nativeFees
        let fee = await nativeOFTWithFee.quoteOFTFee(remoteChainId, totalAmount)
        let nativeFee = (await nativeOFTWithFee.estimateSendFee(remoteChainId, aliceAddressBytes32, totalAmount, false, defaultAdapterParams))
            .nativeFee

        let ld2sdRate = 10 ** (18 - sharedDecimals)
        let dust = totalAmount.sub(fee).mod(ld2sdRate)
        let totalMintAmount = (totalAmount.sub(fee)).sub(dust)

        await nativeOFTWithFee.sendFrom(
            owner.address,
            remoteChainId, // destination chainId
            aliceAddressBytes32, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            totalMintAmount, // quantity of tokens to send (in units of wei)
            [owner.address, ethers.constants.AddressZero, defaultAdapterParams],
            { value: nativeFee.add(totalAmount) } // pass a msg.value to pay the LayerZero message fee
        )
        expect(await ethers.provider.getBalance(localEndpoint.address)).to.be.equal(nativeFee) // collects
        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.be.equal(leftOverAmount)
        expect(await nativeOFTWithFee.balanceOf(bob.address)).to.be.equal(fee)
        expect(await nativeOFTWithFee.balanceOf(nativeOFTWithFee.address)).to.be.equal(totalMintAmount)
        expect(await remoteOFTWithFee.balanceOf(alice.address)).to.be.equal(totalMintAmount)
        expect(await nativeOFTWithFee.outboundAmount()).to.be.equal(totalMintAmount)
        expect(await remoteOFTWithFee.totalSupply()).to.be.equal(totalMintAmount)
    })

    it("sendFrom() w/ fee change - deposit before send", async function () {
        expect(await ethers.provider.getBalance(localEndpoint.address)).to.be.equal(ethers.utils.parseEther("0"))

        // set default fee to 50%
        await nativeOFTWithFee.setDefaultFeeBp(5000)
        await nativeOFTWithFee.setFeeOwner(bob.address)

        // ensure they're both allocated initial amounts
        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.equal(0)
        expect(await remoteOFTWithFee.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFTWithFee.address)).to.equal(0)

        let depositAmount = ethers.utils.parseEther("7")
        await nativeOFTWithFee.deposit({ value: depositAmount })

        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFTWithFee.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseEther("0")
        let totalAmount = ethers.utils.parseEther("8")

        // estimate nativeFees
        let nativeFee = (await nativeOFTWithFee.estimateSendFee(remoteChainId, ownerAddressBytes32, totalAmount, false, defaultAdapterParams))
            .nativeFee
        expect(await ethers.provider.getBalance(localEndpoint.address)).to.be.equal(ethers.utils.parseEther("0"))
        await expect(
            nativeOFTWithFee.sendFrom(
                owner.address,
                remoteChainId, // destination chainId
                ownerAddressBytes32, // destination address to send tokens to
                totalAmount, // quantity of tokens to send (in units of wei)
                totalAmount, // quantity of tokens to send (in units of wei)
                [owner.address, ethers.constants.AddressZero, defaultAdapterParams],
                { value: nativeFee.add(totalAmount.sub(depositAmount)) } // pass a msg.value to pay the LayerZero message fee
            )
        ).to.be.revertedWith("NativeOFTWithFee: amount is less than minAmount")

        expect(await ethers.provider.getBalance(nativeOFTWithFee.address)).to.be.equal(depositAmount)
        expect(await ethers.provider.getBalance(localEndpoint.address)).to.be.equal(0)
        expect(await nativeOFTWithFee.balanceOf(nativeOFTWithFee.address)).to.be.equal(0)
        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.be.equal(depositAmount)
        expect(await remoteOFTWithFee.balanceOf(owner.address)).to.be.equal(0)
        expect(await nativeOFTWithFee.outboundAmount()).to.be.equal(leftOverAmount)
        expect(await remoteOFTWithFee.totalSupply()).to.be.equal(leftOverAmount)

        const aliceAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [alice.address])
        // estimate nativeFees
        let fee = await nativeOFTWithFee.quoteOFTFee(remoteChainId, totalAmount)
        nativeFee = (await nativeOFTWithFee.estimateSendFee(remoteChainId, aliceAddressBytes32, totalAmount, false, defaultAdapterParams))
            .nativeFee
        await nativeOFTWithFee.sendFrom(
            owner.address,
            remoteChainId, // destination chainId
            aliceAddressBytes32, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            totalAmount.sub(fee), // quantity of tokens to send (in units of wei)
            [owner.address, ethers.constants.AddressZero, defaultAdapterParams],
            { value: nativeFee.add(totalAmount.sub(depositAmount)) } // pass a msg.value to pay the LayerZero message fee
        )
        expect(await ethers.provider.getBalance(nativeOFTWithFee.address)).to.be.equal(totalAmount)
        expect(await ethers.provider.getBalance(localEndpoint.address)).to.be.equal(nativeFee) // collects
        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.be.equal(leftOverAmount)
        expect(await nativeOFTWithFee.balanceOf(alice.address)).to.be.equal(leftOverAmount)
        expect(await nativeOFTWithFee.balanceOf(bob.address)).to.be.equal(fee)
        expect(await nativeOFTWithFee.balanceOf(nativeOFTWithFee.address)).to.be.equal(totalAmount.sub(fee))
        expect(await nativeOFTWithFee.outboundAmount()).to.be.equal(totalAmount.div(2))
        expect(await remoteOFTWithFee.totalSupply()).to.be.equal(totalAmount.div(2))
    })

    it("quote oft fee", async function () {
        // default fee 0%
        expect(await nativeOFTWithFee.quoteOFTFee(1, 10000)).to.be.equal(0)

        // change default fee to 10%
        await nativeOFTWithFee.setDefaultFeeBp(1000)
        expect(await nativeOFTWithFee.quoteOFTFee(1, 10000)).to.be.equal(1000)

        // change fee to 20% for chain 2
        await nativeOFTWithFee.setFeeBp(2, true, 2000)
        expect(await nativeOFTWithFee.quoteOFTFee(1, 10000)).to.be.equal(1000)
        expect(await nativeOFTWithFee.quoteOFTFee(2, 10000)).to.be.equal(2000)

        // change fee to 0% for chain 2
        await nativeOFTWithFee.setFeeBp(2, true, 0)
        expect(await nativeOFTWithFee.quoteOFTFee(1, 10000)).to.be.equal(1000)
        expect(await nativeOFTWithFee.quoteOFTFee(2, 10000)).to.be.equal(0)

        // disable fee for chain 2
        await nativeOFTWithFee.setFeeBp(2, false, 0)
        expect(await nativeOFTWithFee.quoteOFTFee(1, 10000)).to.be.equal(1000)
        expect(await nativeOFTWithFee.quoteOFTFee(2, 10000)).to.be.equal(1000)
    })

    it("sendFrom() - with enough native", async function () {
        // ensure they're both allocated initial amounts
        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.equal(0)
        expect(await remoteOFTWithFee.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFTWithFee.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseEther("4.000000000000000001")
        await nativeOFTWithFee.deposit({ value: depositAmount })

        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFTWithFee.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseEther("0.000000000000000001")
        let totalAmount = ethers.utils.parseEther("4.000000000000000001")
        let minAmount = ethers.utils.parseEther("4.000000000000000000")
        let totalAmountMinusDust = ethers.utils.parseEther("4")

        // estimate nativeFees
        let nativeFee = (await nativeOFTWithFee.estimateSendFee(remoteChainId, ownerAddressBytes32, totalAmount, false, defaultAdapterParams))
            .nativeFee
        await nativeOFTWithFee.sendFrom(
            owner.address,
            remoteChainId, // destination chainId
            ownerAddressBytes32, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            minAmount, // quantity of tokens to send (in units of wei)
            [owner.address, ethers.constants.AddressZero, defaultAdapterParams],
            { value: nativeFee.add(totalAmount.sub(depositAmount)) } // pass a msg.value to pay the LayerZero message fee
        )

        expect(await ethers.provider.getBalance(nativeOFTWithFee.address)).to.be.equal(totalAmount)
        expect(await ethers.provider.getBalance(localEndpoint.address)).to.be.equal(nativeFee)
        expect(await ethers.provider.getBalance(remoteEndpoint.address)).to.be.equal(ethers.utils.parseEther("0"))
        expect(await nativeOFTWithFee.balanceOf(nativeOFTWithFee.address)).to.be.equal(totalAmountMinusDust)
        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.be.equal(leftOverAmount)
        expect(await remoteOFTWithFee.balanceOf(owner.address)).to.be.equal(totalAmountMinusDust)
        expect(await nativeOFTWithFee.outboundAmount()).to.be.equal(totalAmountMinusDust)
        expect(await remoteOFTWithFee.totalSupply()).to.be.equal(totalAmountMinusDust)
    })

    it("sendFrom() - from != sender with addition msg.value", async function () {
        // ensure they're both allocated initial amounts
        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.equal(0)
        expect(await remoteOFTWithFee.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFTWithFee.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseEther("3")
        await nativeOFTWithFee.deposit({ value: depositAmount })

        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFTWithFee.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseEther("0")
        let totalAmount = ethers.utils.parseEther("4")

        // approve the other user to send the tokens
        await nativeOFTWithFee.approve(alice.address, totalAmount)

        // estimate nativeFees
        let nativeFee = (await nativeOFTWithFee.estimateSendFee(remoteChainId, ownerAddressBytes32, totalAmount, false, defaultAdapterParams))
            .nativeFee
        await nativeOFTWithFee.connect(alice).sendFrom(
            owner.address,
            remoteChainId, // destination chainId
            ownerAddressBytes32, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            totalAmount, // quantity of tokens to send (in units of wei)
            [owner.address, ethers.constants.AddressZero, defaultAdapterParams],
            { value: nativeFee.add(totalAmount.sub(depositAmount)) } // pass a msg.value to pay the LayerZero message fee
        )

        expect(await ethers.provider.getBalance(nativeOFTWithFee.address)).to.be.equal(totalAmount)
        expect(await ethers.provider.getBalance(localEndpoint.address)).to.be.equal(nativeFee)
        expect(await ethers.provider.getBalance(remoteEndpoint.address)).to.be.equal(ethers.utils.parseEther("0"))
        expect(await nativeOFTWithFee.balanceOf(nativeOFTWithFee.address)).to.be.equal(totalAmount)
        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.be.equal(leftOverAmount)
        expect(await remoteOFTWithFee.balanceOf(owner.address)).to.be.equal(totalAmount)
        expect(await nativeOFTWithFee.outboundAmount()).to.be.equal(totalAmount)
        expect(await remoteOFTWithFee.totalSupply()).to.be.equal(totalAmount)
    })

    it("sendFrom() - from != sender with not enough native", async function () {
        // ensure they're both allocated initial amounts
        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.equal(0)
        expect(await remoteOFTWithFee.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFTWithFee.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseEther("4")
        await nativeOFTWithFee.deposit({ value: depositAmount })

        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFTWithFee.address)).to.be.equal(depositAmount)

        let totalAmount = ethers.utils.parseEther("5")

        // approve the other user to send the tokens
        await nativeOFTWithFee.approve(alice.address, totalAmount)

        let messageFee = ethers.utils.parseEther("0.5") // conversion to units of wei
        await expect(
            nativeOFTWithFee.connect(alice).sendFrom(
                owner.address,
                remoteChainId, // destination chainId
                ownerAddressBytes32, // destination address to send tokens to
                totalAmount, // quantity of tokens to send (in units of wei)
                totalAmount, // quantity of tokens to send (in units of wei)
                [owner.address, ethers.constants.AddressZero, defaultAdapterParams],
                { value: messageFee } // pass a msg.value to pay the LayerZero message fee
            )
        ).to.be.revertedWith("NativeOFTWithFee: Insufficient msg.value")
    })

    it("sendFrom() - from != sender not approved expect revert", async function () {
        // ensure they're both allocated initial amounts
        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.equal(0)
        expect(await remoteOFTWithFee.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFTWithFee.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseEther("4")
        await nativeOFTWithFee.deposit({ value: depositAmount })

        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFTWithFee.address)).to.be.equal(depositAmount)

        let totalAmount = ethers.utils.parseEther("4")

        let messageFee = ethers.utils.parseEther("1") // conversion to units of wei
        await expect(
            nativeOFTWithFee.connect(alice).sendFrom(
                owner.address,
                remoteChainId, // destination chainId
                ownerAddressBytes32, // destination address to send tokens to
                totalAmount, // quantity of tokens to send (in units of wei)
                totalAmount, // quantity of tokens to send (in units of wei)
                [owner.address, ethers.constants.AddressZero, defaultAdapterParams],
                { value: messageFee } // pass a msg.value to pay the LayerZero message fee
            )
        ).to.be.revertedWith("ERC20: insufficient allowance")
    })

    it("sendFrom() - with insufficient value and expect revert", async function () {
        // ensure they're both allocated initial amounts
        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.equal(0)
        expect(await remoteOFTWithFee.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFTWithFee.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseEther("4")
        await nativeOFTWithFee.deposit({ value: depositAmount })

        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFTWithFee.address)).to.be.equal(depositAmount)

        let totalAmount = ethers.utils.parseEther("8")
        let messageFee = ethers.utils.parseEther("3") // conversion to units of wei
        await expect(
            nativeOFTWithFee.sendFrom(
                owner.address,
                remoteChainId, // destination chainId
                ownerAddressBytes32, // destination address to send tokens to
                totalAmount, // quantity of tokens to send (in units of wei)
                totalAmount, // quantity of tokens to send (in units of wei)
                [owner.address, ethers.constants.AddressZero, defaultAdapterParams],
                { value: messageFee } // pass a msg.value to pay the LayerZero message fee
            )
        ).to.be.revertedWith("NativeOFTWithFee: Insufficient msg.value")
    })

    it("sendFrom() - tokens from main to other chain using adapterParam", async function () {
        // ensure they're both allocated initial amounts
        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.equal(0)
        expect(await remoteOFTWithFee.balanceOf(owner.address)).to.equal(0)

        const amount = ethers.utils.parseEther("100")
        const messageFee = ethers.utils.parseEther("101") // conversion to units of wei
        await nativeOFTWithFee.setMinDstGas(remoteChainId, parseInt(await nativeOFTWithFee.PT_SEND()), 225000)
        const adapterParam = ethers.utils.solidityPack(["uint16", "uint256"], [1, 225000])
        await nativeOFTWithFee.sendFrom(
            owner.address,
            remoteChainId, // destination chainId
            ownerAddressBytes32, // destination address to send tokens to
            amount, // quantity of tokens to send (in units of wei)
            amount, // quantity of tokens to send (in units of wei)
            [owner.address, ethers.constants.AddressZero, adapterParam],
            { value: messageFee } // pass a msg.value to pay the LayerZero message fee
        )

        // verify tokens burned on source chain and minted on destination chain
        expect(await nativeOFTWithFee.balanceOf(nativeOFTWithFee.address)).to.be.equal(amount)
        expect(await remoteOFTWithFee.balanceOf(owner.address)).to.be.equal(amount)
        expect(await nativeOFTWithFee.outboundAmount()).to.be.equal(amount)
        expect(await remoteOFTWithFee.totalSupply()).to.be.equal(amount)
    })

    it("setMinDstGas() - when type is not set on destination chain", async function () {
        await nativeOFTWithFee.setMinDstGas(remoteChainId, 0, 0)

        const amount = ethers.utils.parseEther("100")
        const messageFee = ethers.utils.parseEther("101") // conversion to units of wei
        const adapterParam = ethers.utils.solidityPack(["uint16", "uint256"], [1, 225000])
        await expect(
            nativeOFTWithFee.sendFrom(
                owner.address,
                remoteChainId, // destination chainId
                ownerAddressBytes32, // destination address to send tokens to
                amount, // quantity of tokens to send (in units of wei)
                amount, // quantity of tokens to send (in units of wei)
                [owner.address, ethers.constants.AddressZero, adapterParam],
                { value: messageFee } // pass a msg.value to pay the LayerZero message fee
            )
        ).to.be.revertedWith("LzApp: minGasLimit not set")
    })

    it("setMinDstGas() - set min dst gas higher than what we are sending and expect revert", async function () {
        const amount = ethers.utils.parseEther("100")
        const messageFee = ethers.utils.parseEther("101") // conversion to units of wei
        await nativeOFTWithFee.setMinDstGas(remoteChainId, parseInt(await nativeOFTWithFee.PT_SEND()), 250000)
        const adapterParam = ethers.utils.solidityPack(["uint16", "uint256"], [1, 225000])
        await expect(
            nativeOFTWithFee.sendFrom(
                owner.address,
                remoteChainId, // destination chainId
                ownerAddressBytes32, // destination address to send tokens to
                amount, // quantity of tokens to send (in units of wei)
                amount, // quantity of tokens to send (in units of wei)
                [owner.address, ethers.constants.AddressZero, adapterParam],
                { value: messageFee } // pass a msg.value to pay the LayerZero message fee
            )
        ).to.be.revertedWith("LzApp: gas limit is too low")
    })

    it("wrap() and unwrap()", async function () {
        let ownerBalance = await ethers.provider.getBalance(owner.address)
        expect(await ethers.provider.getBalance(nativeOFTWithFee.address)).to.equal(0)
        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.equal(0)

        const amount = ethers.utils.parseEther("100.000000000000000001")
        await nativeOFTWithFee.deposit({ value: amount })

        let transFee = ownerBalance.sub(await ethers.provider.getBalance(owner.address)).sub(amount)

        expect(await ethers.provider.getBalance(nativeOFTWithFee.address)).to.equal(amount)
        expect(await ethers.provider.getBalance(owner.address)).to.equal(ownerBalance.sub(amount).sub(transFee))
        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.equal(amount)

        await nativeOFTWithFee.withdraw(amount)
        transFee = ownerBalance.sub(await ethers.provider.getBalance(owner.address))

        expect(await ethers.provider.getBalance(nativeOFTWithFee.address)).to.equal(0)
        expect(await ethers.provider.getBalance(owner.address)).to.equal(ownerBalance.sub(transFee))
        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.equal(0)
    })

    it("wrap() and unwrap() expect revert", async function () {
        let ownerBalance = await ethers.provider.getBalance(owner.address)
        expect(await ethers.provider.getBalance(nativeOFTWithFee.address)).to.equal(0)
        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.equal(0)

        let amount = ethers.utils.parseEther("100")
        await nativeOFTWithFee.deposit({ value: amount })

        let transFee = ownerBalance.sub(await ethers.provider.getBalance(owner.address)).sub(amount)

        expect(await ethers.provider.getBalance(nativeOFTWithFee.address)).to.equal(amount)
        expect(await ethers.provider.getBalance(owner.address)).to.equal(ownerBalance.sub(amount).sub(transFee))
        expect(await nativeOFTWithFee.balanceOf(owner.address)).to.equal(amount)

        amount = ethers.utils.parseEther("150")
        await expect(nativeOFTWithFee.withdraw(amount)).to.be.revertedWith("NativeOFTWithFee: Insufficient balance.")
    })
})
