const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("NativeOFTV2: ", function () {
    const localChainId = 1
    const remoteChainId = 2
    const name = "NativeOFTV2"
    const symbol = "NOFT"
    const sharedDecimals = 6

    let owner, alice, localEndpoint, remoteEndpoint, nativeOFTV2, remoteOFTV2, LZEndpointMock, NativeOFTV2, OFTV2, ownerAddressBytes32

    let defaultAdapterParams = ethers.utils.solidityPack(["uint16", "uint256"], [1, 200000])

    before(async function () {
        ;[owner, alice] = await ethers.getSigners()
        LZEndpointMock = await ethers.getContractFactory("LZEndpointMock")
        NativeOFTV2 = await ethers.getContractFactory("NativeOFTV2")
        OFTV2 = await ethers.getContractFactory("OFTV2")
    })

    beforeEach(async function () {
        localEndpoint = await LZEndpointMock.deploy(localChainId)
        remoteEndpoint = await LZEndpointMock.deploy(remoteChainId)

        //------  deploy: base & other chain  -------------------------------------------------------
        // create two NativeOFTV2 instances. both tokens have the same name and symbol on each chain
        // 1. base chain
        // 2. other chain
        nativeOFTV2 = await NativeOFTV2.deploy(name, symbol, sharedDecimals, localEndpoint.address)
        remoteOFTV2 = await OFTV2.deploy(name, symbol, sharedDecimals, remoteEndpoint.address)

        // internal bookkeeping for endpoints (not part of a real deploy, just for this test)
        await localEndpoint.setDestLzEndpoint(remoteOFTV2.address, remoteEndpoint.address)
        await remoteEndpoint.setDestLzEndpoint(nativeOFTV2.address, localEndpoint.address)

        //------  setTrustedRemote(s) -------------------------------------------------------
        // for each OFTV2, setTrustedRemote to allow it to receive from the remote OFTV2 contract.
        // Note: This is sometimes referred to as the "wire-up" process.
        // set each contracts source address so it can send to each other
        await nativeOFTV2.setTrustedRemoteAddress(remoteChainId, remoteOFTV2.address)
        await remoteOFTV2.setTrustedRemoteAddress(localChainId, nativeOFTV2.address)

        await nativeOFTV2.setMinDstGas(remoteChainId, 0, 200000)
        await nativeOFTV2.setMinDstGas(remoteChainId, 1, 200000)
        await remoteOFTV2.setMinDstGas(localChainId, 0, 200000)
        await remoteOFTV2.setMinDstGas(localChainId, 1, 200000)

        ownerAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [owner.address])
    })

    it("sendFrom() - tokens from main to other chain using default", async function () {
        expect(await ethers.provider.getBalance(localEndpoint.address)).to.be.equal(ethers.utils.parseEther("0"))

        // ensure they're both allocated initial amounts
        let aliceBalance = await ethers.provider.getBalance(alice.address)
        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await remoteOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.equal(0)

        let depositAmount = ethers.utils.parseEther("7")
        await nativeOFTV2.deposit({ value: depositAmount })

        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseEther("0")
        let totalAmount = ethers.utils.parseEther("8")

        // estimate nativeFees
        let nativeFee = (await nativeOFTV2.estimateSendFee(remoteChainId, ownerAddressBytes32, totalAmount, false, defaultAdapterParams))
            .nativeFee
        expect(await ethers.provider.getBalance(localEndpoint.address)).to.be.equal(ethers.utils.parseEther("0"))
        await nativeOFTV2.sendFrom(
            owner.address,
            remoteChainId, // destination chainId
            ownerAddressBytes32, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            [owner.address, ethers.constants.AddressZero, defaultAdapterParams],
            { value: nativeFee.add(totalAmount.sub(depositAmount)) } // pass a msg.value to pay the LayerZero message fee
        )

        // expect(await ethers.provider.getBalance(owner.address)).to.be.equal(ownerBalance.sub(messageFee).sub(transFee).sub(depositAmount))
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(totalAmount)
        expect(await ethers.provider.getBalance(localEndpoint.address)).to.be.equal(nativeFee) // collects
        expect(await nativeOFTV2.balanceOf(nativeOFTV2.address)).to.be.equal(totalAmount)
        expect(await nativeOFTV2.balanceOf(owner.address)).to.be.equal(leftOverAmount)
        expect(await remoteOFTV2.balanceOf(owner.address)).to.be.equal(totalAmount)
        expect(await nativeOFTV2.outboundAmount()).to.be.equal(totalAmount)
        expect(await remoteOFTV2.totalSupply()).to.be.equal(totalAmount)


        let ownerBalance2 = await ethers.provider.getBalance(owner.address)

        const aliceAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [alice.address])
        // estimate nativeFees
        nativeFee = (await nativeOFTV2.estimateSendFee(localChainId, aliceAddressBytes32, totalAmount, false, defaultAdapterParams)).nativeFee
        await remoteOFTV2.sendFrom(
            owner.address,
            localChainId, // destination chainId
            aliceAddressBytes32, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            [owner.address, ethers.constants.AddressZero, defaultAdapterParams],
            { value: nativeFee.add(totalAmount) } // pass a msg.value to pay the LayerZero message fee
        )

        let transFee = ownerBalance2.sub(await ethers.provider.getBalance(owner.address)).sub(nativeFee)
        expect(await ethers.provider.getBalance(alice.address)).to.be.equal(aliceBalance.add(totalAmount))
        expect(await ethers.provider.getBalance(owner.address)).to.be.equal(ownerBalance2.sub(nativeFee).sub(transFee))
        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(leftOverAmount)
        expect(await remoteOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await remoteOFTV2.totalSupply()).to.be.equal(leftOverAmount)
        expect(await nativeOFTV2.outboundAmount()).to.be.equal(leftOverAmount)
    })

    it("sendFrom() - with enough native", async function () {
        // ensure they're both allocated initial amounts
        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await remoteOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseEther("4.000000000000000001")
        await nativeOFTV2.deposit({ value: depositAmount })

        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseEther("0.000000000000000001")
        let totalAmount = ethers.utils.parseEther("4.000000000000000001")
        let totalAmountMinusDust = ethers.utils.parseEther("4")

        // estimate nativeFees
        let nativeFee = (await nativeOFTV2.estimateSendFee(remoteChainId, ownerAddressBytes32, totalAmount, false, defaultAdapterParams))
            .nativeFee
        await nativeOFTV2.sendFrom(
            owner.address,
            remoteChainId, // destination chainId
            ownerAddressBytes32, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            [owner.address, ethers.constants.AddressZero, defaultAdapterParams],
            { value: nativeFee.add(totalAmount.sub(depositAmount)) } // pass a msg.value to pay the LayerZero message fee
        )

        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(totalAmount)
        expect(await ethers.provider.getBalance(localEndpoint.address)).to.be.equal(nativeFee)
        expect(await ethers.provider.getBalance(remoteEndpoint.address)).to.be.equal(ethers.utils.parseEther("0"))
        expect(await nativeOFTV2.balanceOf(nativeOFTV2.address)).to.be.equal(totalAmountMinusDust)
        expect(await nativeOFTV2.balanceOf(owner.address)).to.be.equal(leftOverAmount)
        expect(await remoteOFTV2.balanceOf(owner.address)).to.be.equal(totalAmountMinusDust)
        expect(await nativeOFTV2.outboundAmount()).to.be.equal(totalAmountMinusDust)
        expect(await remoteOFTV2.totalSupply()).to.be.equal(totalAmountMinusDust)
    })

    it("sendFrom() - from != sender with addition msg.value", async function () {
        // ensure they're both allocated initial amounts
        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await remoteOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseEther("3")
        await nativeOFTV2.deposit({ value: depositAmount })

        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseEther("0")
        let totalAmount = ethers.utils.parseEther("4")

        // approve the other user to send the tokens
        await nativeOFTV2.approve(alice.address, totalAmount)

        // estimate nativeFees
        let nativeFee = (await nativeOFTV2.estimateSendFee(remoteChainId, ownerAddressBytes32, totalAmount, false, defaultAdapterParams))
            .nativeFee
        await nativeOFTV2.connect(alice).sendFrom(
            owner.address,
            remoteChainId, // destination chainId
            ownerAddressBytes32, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            [owner.address, ethers.constants.AddressZero, defaultAdapterParams],
            { value: nativeFee.add(totalAmount.sub(depositAmount)) } // pass a msg.value to pay the LayerZero message fee
        )

        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(totalAmount)
        expect(await ethers.provider.getBalance(localEndpoint.address)).to.be.equal(nativeFee)
        expect(await ethers.provider.getBalance(remoteEndpoint.address)).to.be.equal(ethers.utils.parseEther("0"))
        expect(await nativeOFTV2.balanceOf(nativeOFTV2.address)).to.be.equal(totalAmount)
        expect(await nativeOFTV2.balanceOf(owner.address)).to.be.equal(leftOverAmount)
        expect(await remoteOFTV2.balanceOf(owner.address)).to.be.equal(totalAmount)
        expect(await nativeOFTV2.outboundAmount()).to.be.equal(totalAmount)
        expect(await remoteOFTV2.totalSupply()).to.be.equal(totalAmount)
    })

    it("sendFrom() - from != sender with not enough native", async function () {
        // ensure they're both allocated initial amounts
        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await remoteOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseEther("4")
        await nativeOFTV2.deposit({ value: depositAmount })

        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(depositAmount)

        let totalAmount = ethers.utils.parseEther("5")

        // approve the other user to send the tokens
        await nativeOFTV2.approve(alice.address, totalAmount)

        let messageFee = ethers.utils.parseEther("0.5") // conversion to units of wei
        await expect(
            nativeOFTV2.connect(alice).sendFrom(
                owner.address,
                remoteChainId, // destination chainId
                ownerAddressBytes32, // destination address to send tokens to
                totalAmount, // quantity of tokens to send (in units of wei)
                [owner.address, ethers.constants.AddressZero, defaultAdapterParams],
                { value: messageFee } // pass a msg.value to pay the LayerZero message fee
            )
        ).to.be.revertedWith("NativeOFTV2: Insufficient msg.value")
    })

    it("sendFrom() - from != sender not approved expect revert", async function () {
        // ensure they're both allocated initial amounts
        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await remoteOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseEther("4")
        await nativeOFTV2.deposit({ value: depositAmount })

        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(depositAmount)

        let totalAmount = ethers.utils.parseEther("4")

        let messageFee = ethers.utils.parseEther("1") // conversion to units of wei
        await expect(
            nativeOFTV2.connect(alice).sendFrom(
                owner.address,
                remoteChainId, // destination chainId
                ownerAddressBytes32, // destination address to send tokens to
                totalAmount, // quantity of tokens to send (in units of wei)
                [owner.address, ethers.constants.AddressZero, defaultAdapterParams],
                { value: messageFee } // pass a msg.value to pay the LayerZero message fee
            )
        ).to.be.revertedWith("ERC20: insufficient allowance")
    })

    it("sendFrom() - with insufficient value and expect revert", async function () {
        // ensure they're both allocated initial amounts
        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await remoteOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseEther("4")
        await nativeOFTV2.deposit({ value: depositAmount })

        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(depositAmount)

        let totalAmount = ethers.utils.parseEther("8")
        let messageFee = ethers.utils.parseEther("3") // conversion to units of wei
        await expect(
            nativeOFTV2.sendFrom(
                owner.address,
                remoteChainId, // destination chainId
                ownerAddressBytes32, // destination address to send tokens to
                totalAmount, // quantity of tokens to send (in units of wei)
                [owner.address, ethers.constants.AddressZero, defaultAdapterParams],
                { value: messageFee } // pass a msg.value to pay the LayerZero message fee
            )
        ).to.be.revertedWith("NativeOFTV2: Insufficient msg.value")
    })

    it("sendFrom() - tokens from main to other chain using adapterParam", async function () {
        // ensure they're both allocated initial amounts
        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await remoteOFTV2.balanceOf(owner.address)).to.equal(0)

        const amount = ethers.utils.parseEther("100")
        const messageFee = ethers.utils.parseEther("101") // conversion to units of wei
        await nativeOFTV2.setMinDstGas(remoteChainId, parseInt(await nativeOFTV2.PT_SEND()), 225000)
        const adapterParam = ethers.utils.solidityPack(["uint16", "uint256"], [1, 225000])
        await nativeOFTV2.sendFrom(
            owner.address,
            remoteChainId, // destination chainId
            ownerAddressBytes32, // destination address to send tokens to
            amount, // quantity of tokens to send (in units of wei)
            [owner.address, ethers.constants.AddressZero, adapterParam],
            { value: messageFee } // pass a msg.value to pay the LayerZero message fee
        )

        // verify tokens burned on source chain and minted on destination chain
        expect(await nativeOFTV2.balanceOf(nativeOFTV2.address)).to.be.equal(amount)
        expect(await remoteOFTV2.balanceOf(owner.address)).to.be.equal(amount)
        expect(await nativeOFTV2.outboundAmount()).to.be.equal(amount)
        expect(await remoteOFTV2.totalSupply()).to.be.equal(amount)
    })

    it("setMinDstGas() - when type is not set on destination chain", async function () {
        // reset the min dst to 0
        await nativeOFTV2.setMinDstGas(remoteChainId, 0, 0)

        const amount = ethers.utils.parseEther("100")
        const messageFee = ethers.utils.parseEther("101") // conversion to units of wei
        const adapterParam = ethers.utils.solidityPack(["uint16", "uint256"], [1, 225000])
        await expect(
            nativeOFTV2.sendFrom(
                owner.address,
                remoteChainId, // destination chainId
                ownerAddressBytes32, // destination address to send tokens to
                amount, // quantity of tokens to send (in units of wei)
                [owner.address, ethers.constants.AddressZero, adapterParam],
                { value: messageFee } // pass a msg.value to pay the LayerZero message fee
            )
        ).to.be.revertedWith("LzApp: minGasLimit not set")
    })

    it("setMinDstGas() - set min dst gas higher than what we are sending and expect revert", async function () {
        const amount = ethers.utils.parseEther("100")
        const messageFee = ethers.utils.parseEther("101") // conversion to units of wei
        await nativeOFTV2.setMinDstGas(remoteChainId, parseInt(await nativeOFTV2.PT_SEND()), 250000)
        const adapterParam = ethers.utils.solidityPack(["uint16", "uint256"], [1, 225000])
        await expect(
            nativeOFTV2.sendFrom(
                owner.address,
                remoteChainId, // destination chainId
                ownerAddressBytes32, // destination address to send tokens to
                amount, // quantity of tokens to send (in units of wei)
                [owner.address, ethers.constants.AddressZero, adapterParam],
                { value: messageFee } // pass a msg.value to pay the LayerZero message fee
            )
        ).to.be.revertedWith("LzApp: gas limit is too low")
    })

    it("wrap() and unwrap()", async function () {
        let ownerBalance = await ethers.provider.getBalance(owner.address)
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.equal(0)
        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(0)

        const amount = ethers.utils.parseEther("100.000000000000000001")
        await nativeOFTV2.deposit({ value: amount })

        let transFee = ownerBalance.sub(await ethers.provider.getBalance(owner.address)).sub(amount)

        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.equal(amount)
        expect(await ethers.provider.getBalance(owner.address)).to.equal(ownerBalance.sub(amount).sub(transFee))
        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(amount)

        await nativeOFTV2.withdraw(amount)
        transFee = ownerBalance.sub(await ethers.provider.getBalance(owner.address))

        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.equal(0)
        expect(await ethers.provider.getBalance(owner.address)).to.equal(ownerBalance.sub(transFee))
        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(0)
    })

    it("wrap() and unwrap() expect revert", async function () {
        let ownerBalance = await ethers.provider.getBalance(owner.address)
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.equal(0)
        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(0)

        let amount = ethers.utils.parseEther("100")
        await nativeOFTV2.deposit({ value: amount })

        let transFee = ownerBalance.sub(await ethers.provider.getBalance(owner.address)).sub(amount)

        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.equal(amount)
        expect(await ethers.provider.getBalance(owner.address)).to.equal(ownerBalance.sub(amount).sub(transFee))
        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(amount)

        amount = ethers.utils.parseEther("150")
        await expect(nativeOFTV2.withdraw(amount)).to.be.revertedWith("NativeOFTV2: Insufficient balance.")
    })
})
