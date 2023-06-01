const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("NativeOFTV2: ", function () {
    const localChainId = 1
    const remoteChainId = 2
    const name = "NativeOFTV2"
    const symbol = "NOFT"
    const sharedDecimals = 6

    let owner, alice, localEndpoint, remoteEndpoint, nativeOFTV2, remoteOFTV2, LZEndpointMock, NativeOFTV2, OFTV2, remotePath, localPath

    before(async function () {
        owner = (await ethers.getSigners())[0]
        alice = (await ethers.getSigners())[1]
        LZEndpointMock = await ethers.getContractFactory("LZEndpointMock")
        NativeOFTV2 = await ethers.getContractFactory("NativeOFTV2")
        OFTV2 = await ethers.getContractFactory("OFTV2")
    })

    beforeEach(async function () {
        localEndpoint = await LZEndpointMock.deploy(localChainId)
        remoteEndpoint = await LZEndpointMock.deploy(remoteChainId)

        expect(await localEndpoint.getChainId()).to.equal(localChainId)
        expect(await remoteEndpoint.getChainId()).to.equal(remoteChainId)

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
        remotePath = ethers.utils.solidityPack(["address", "address"], [remoteOFTV2.address, nativeOFTV2.address])
        localPath = ethers.utils.solidityPack(["address", "address"], [nativeOFTV2.address, remoteOFTV2.address])
        await nativeOFTV2.setTrustedRemote(remoteChainId, remotePath)
        await remoteOFTV2.setTrustedRemote(localChainId, localPath)

        await nativeOFTV2.setUseCustomAdapterParams(true)
        // ... the deployed OFTs are ready now!
    })

    it("sendFrom() - tokens from main to other chain using default", async function () {
        expect(await ethers.provider.getBalance(localEndpoint.address)).to.be.equal(ethers.utils.parseUnits("0", 18))

        await nativeOFTV2.setUseCustomAdapterParams(false)
        await remoteOFTV2.setUseCustomAdapterParams(false)

        // ensure they're both allocated initial amounts
        let aliceBalance = await ethers.provider.getBalance(alice.address)
        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await remoteOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseUnits("7", 18)
        await nativeOFTV2.deposit({ value: depositAmount })

        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseUnits("0", 18)
        let totalAmount = ethers.utils.parseUnits("8", 18)

        const ownerAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [owner.address])
        // estimate nativeFees
        let nativeFee = (await nativeOFTV2.estimateSendFee(remoteChainId, ownerAddressBytes32, totalAmount, false, "0x")).nativeFee
        expect(await ethers.provider.getBalance(localEndpoint.address)).to.be.equal(ethers.utils.parseUnits("0", 18))
        await nativeOFTV2.sendFrom(
            owner.address,
            remoteChainId, // destination chainId
            ownerAddressBytes32, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            [owner.address, ethers.constants.AddressZero, "0x"],
            { value: nativeFee.add(totalAmount.sub(depositAmount)) } // pass a msg.value to pay the LayerZero message fee
        )

        // expect(await ethers.provider.getBalance(owner.address)).to.be.equal(ownerBalance.sub(messageFee).sub(transFee).sub(depositAmount))
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(totalAmount)
        expect(await ethers.provider.getBalance(localEndpoint.address)).to.be.equal(nativeFee) // collects
        expect(await nativeOFTV2.balanceOf(nativeOFTV2.address)).to.be.equal(totalAmount)
        expect(await nativeOFTV2.balanceOf(owner.address)).to.be.equal(leftOverAmount)
        expect(await remoteOFTV2.balanceOf(owner.address)).to.be.equal(totalAmount)

        let ownerBalance2 = await ethers.provider.getBalance(owner.address)

        const aliceAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [alice.address])
        // estimate nativeFees
        nativeFee = (await nativeOFTV2.estimateSendFee(localChainId, aliceAddressBytes32, totalAmount, false, "0x")).nativeFee
        await remoteOFTV2.sendFrom(
            owner.address,
            localChainId, // destination chainId
            aliceAddressBytes32, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            [owner.address, ethers.constants.AddressZero, "0x"],
            { value: nativeFee.add(totalAmount) } // pass a msg.value to pay the LayerZero message fee
        )

        let transFee = ownerBalance2.sub(await ethers.provider.getBalance(owner.address)).sub(nativeFee)
        expect(await ethers.provider.getBalance(alice.address)).to.be.equal(aliceBalance.add(totalAmount))
        expect(await ethers.provider.getBalance(owner.address)).to.be.equal(ownerBalance2.sub(nativeFee).sub(transFee))
        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(leftOverAmount)
        expect(await remoteOFTV2.balanceOf(owner.address)).to.equal(0)
    })

    it("sendFrom() - with enough native", async function () {
        await nativeOFTV2.setUseCustomAdapterParams(false)
        await remoteOFTV2.setUseCustomAdapterParams(false)

        // ensure they're both allocated initial amounts
        let ownerBalance = await ethers.provider.getBalance(owner.address)
        let aliceBalance = await ethers.provider.getBalance(alice.address)
        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await remoteOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseUnits("4", 18)
        await nativeOFTV2.deposit({ value: depositAmount })

        let transFee_1 = ownerBalance.sub(await ethers.provider.getBalance(owner.address)).sub(depositAmount)

        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseUnits("0", 18)
        let sentFee = ethers.utils.parseUnits("2", 18)
        let totalAmount = ethers.utils.parseUnits("4", 18)

        let messageFee = ethers.utils.parseUnits("1", 18) // conversion to units of wei

        const ownerAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [owner.address])
        // estimate nativeFees
        let nativeFee = (await nativeOFTV2.estimateSendFee(remoteChainId, ownerAddressBytes32, totalAmount, false, "0x")).nativeFee
        await nativeOFTV2.sendFrom(
            owner.address,
            remoteChainId, // destination chainId
            ownerAddressBytes32, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            [owner.address, ethers.constants.AddressZero, "0x"],
            { value: nativeFee.add(totalAmount.sub(depositAmount)) } // pass a msg.value to pay the LayerZero message fee
        )

        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(totalAmount)
        expect(await ethers.provider.getBalance(localEndpoint.address)).to.be.equal(nativeFee)
        expect(await ethers.provider.getBalance(remoteEndpoint.address)).to.be.equal(ethers.utils.parseUnits("0", 18))
        expect(await nativeOFTV2.balanceOf(nativeOFTV2.address)).to.be.equal(totalAmount)
        expect(await nativeOFTV2.balanceOf(owner.address)).to.be.equal(leftOverAmount)
        expect(await remoteOFTV2.balanceOf(owner.address)).to.be.equal(totalAmount)
    })

    it("sendFrom() - from != sender with enough native", async function () {
        await nativeOFTV2.setUseCustomAdapterParams(false)
        await remoteOFTV2.setUseCustomAdapterParams(false)

        // ensure they're both allocated initial amounts
        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await remoteOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseUnits("4", 18)
        await nativeOFTV2.deposit({ value: depositAmount })

        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseUnits("0", 18)
        let totalAmount = ethers.utils.parseUnits("4", 18)

        // approve the other user to send the tokens
        await nativeOFTV2.approve(alice.address, totalAmount)

        const ownerAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [owner.address])
        // estimate nativeFees
        let nativeFee = (await nativeOFTV2.estimateSendFee(remoteChainId, ownerAddressBytes32, totalAmount, false, "0x")).nativeFee
        await nativeOFTV2.connect(alice).sendFrom(
            owner.address,
            remoteChainId, // destination chainId
            ownerAddressBytes32, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            [owner.address, ethers.constants.AddressZero, "0x"],
            { value: nativeFee.add(totalAmount.sub(depositAmount)) } // pass a msg.value to pay the LayerZero message fee
        )

        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(totalAmount)
        expect(await ethers.provider.getBalance(localEndpoint.address)).to.be.equal(nativeFee)
        expect(await ethers.provider.getBalance(remoteEndpoint.address)).to.be.equal(ethers.utils.parseUnits("0", 18))
        expect(await nativeOFTV2.balanceOf(nativeOFTV2.address)).to.be.equal(totalAmount)
        expect(await nativeOFTV2.balanceOf(owner.address)).to.be.equal(leftOverAmount)
        expect(await remoteOFTV2.balanceOf(owner.address)).to.be.equal(totalAmount)
    })

    it("sendFrom() - from != sender with addition msg.value", async function () {
        await nativeOFTV2.setUseCustomAdapterParams(false)
        await remoteOFTV2.setUseCustomAdapterParams(false)

        // ensure they're both allocated initial amounts
        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await remoteOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseUnits("3", 18)
        await nativeOFTV2.deposit({ value: depositAmount })

        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseUnits("0", 18)
        let sentFee = ethers.utils.parseUnits("2", 18)
        let totalAmount = ethers.utils.parseUnits("4", 18)

        // approve the other user to send the tokens
        await nativeOFTV2.approve(alice.address, totalAmount)

        const ownerAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [owner.address])
        // estimate nativeFees
        let nativeFee = (await nativeOFTV2.estimateSendFee(remoteChainId, ownerAddressBytes32, totalAmount, false, "0x")).nativeFee
        await nativeOFTV2.connect(alice).sendFrom(
            owner.address,
            remoteChainId, // destination chainId
            ownerAddressBytes32, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            [owner.address, ethers.constants.AddressZero, "0x"],
            { value: nativeFee.add(totalAmount.sub(depositAmount)) } // pass a msg.value to pay the LayerZero message fee
        )

        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(totalAmount)
        expect(await ethers.provider.getBalance(localEndpoint.address)).to.be.equal(nativeFee)
        expect(await ethers.provider.getBalance(remoteEndpoint.address)).to.be.equal(ethers.utils.parseUnits("0", 18))
        expect(await nativeOFTV2.balanceOf(nativeOFTV2.address)).to.be.equal(totalAmount)
        expect(await nativeOFTV2.balanceOf(owner.address)).to.be.equal(leftOverAmount)
        expect(await remoteOFTV2.balanceOf(owner.address)).to.be.equal(totalAmount)
    })

    it("sendFrom() - from != sender with not enough native", async function () {
        // ensure they're both allocated initial amounts
        let ownerBalance = await ethers.provider.getBalance(owner.address)
        let aliceBalance = await ethers.provider.getBalance(alice.address)
        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await remoteOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseUnits("4", 18)
        await nativeOFTV2.deposit({ value: depositAmount })

        let transFee_1 = ownerBalance.sub(await ethers.provider.getBalance(owner.address)).sub(depositAmount)

        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseUnits("0", 18)
        let sentFee = ethers.utils.parseUnits("2", 18)
        let totalAmount = ethers.utils.parseUnits("5", 18)

        // approve the other user to send the tokens
        await nativeOFTV2.approve(alice.address, totalAmount)

        const ownerAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [owner.address])
        let messageFee = ethers.utils.parseUnits("0.5", 18) // conversion to units of wei
        await nativeOFTV2.setUseCustomAdapterParams(false)
        await remoteOFTV2.setUseCustomAdapterParams(false)
        await expect(
            nativeOFTV2.connect(alice).sendFrom(
                owner.address,
                remoteChainId, // destination chainId
                ownerAddressBytes32, // destination address to send tokens to
                totalAmount, // quantity of tokens to send (in units of wei)
                [owner.address, ethers.constants.AddressZero, "0x"],
                { value: messageFee } // pass a msg.value to pay the LayerZero message fee
            )
        ).to.be.revertedWith("NativeOFTV2: Insufficient msg.value")
    })

    it("sendFrom() - from != sender not approved expect revert", async function () {
        // ensure they're both allocated initial amounts
        let ownerBalance = await ethers.provider.getBalance(owner.address)
        let aliceBalance = await ethers.provider.getBalance(alice.address)
        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await remoteOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseUnits("4", 18)
        await nativeOFTV2.deposit({ value: depositAmount })

        let transFee_1 = ownerBalance.sub(await ethers.provider.getBalance(owner.address)).sub(depositAmount)

        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseUnits("0", 18)
        let sentFee = ethers.utils.parseUnits("2", 18)
        let totalAmount = ethers.utils.parseUnits("4", 18)

        // approve the other user to send the tokens
        // await nativeOFTV2.approve(alice.address, totalAmount)

        const ownerAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [owner.address])
        let messageFee = ethers.utils.parseUnits("1", 18) // conversion to units of wei
        await nativeOFTV2.setUseCustomAdapterParams(false)
        await remoteOFTV2.setUseCustomAdapterParams(false)
        await expect(
            nativeOFTV2.connect(alice).sendFrom(
                owner.address,
                remoteChainId, // destination chainId
                ownerAddressBytes32, // destination address to send tokens to
                totalAmount, // quantity of tokens to send (in units of wei)
                [owner.address, ethers.constants.AddressZero, "0x"],
                { value: messageFee } // pass a msg.value to pay the LayerZero message fee
            )
        ).to.be.revertedWith("ERC20: insufficient allowance")
    })

    it("sendFrom() - with insufficient value and expect revert", async function () {
        // ensure they're both allocated initial amounts
        let ownerBalance = await ethers.provider.getBalance(owner.address)
        let aliceBalance = await ethers.provider.getBalance(alice.address)
        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await remoteOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseUnits("4", 18)
        await nativeOFTV2.deposit({ value: depositAmount })

        let transFee_1 = ownerBalance.sub(await ethers.provider.getBalance(owner.address)).sub(depositAmount)

        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseUnits("0", 18)
        let sentFee = ethers.utils.parseUnits("2", 18)
        let totalAmount = ethers.utils.parseUnits("8", 18)

        const ownerAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [owner.address])
        let messageFee = ethers.utils.parseUnits("3", 18) // conversion to units of wei
        await nativeOFTV2.setUseCustomAdapterParams(false)
        await remoteOFTV2.setUseCustomAdapterParams(false)
        await expect(
            nativeOFTV2.sendFrom(
                owner.address,
                remoteChainId, // destination chainId
                ownerAddressBytes32, // destination address to send tokens to
                totalAmount, // quantity of tokens to send (in units of wei)
                [owner.address, ethers.constants.AddressZero, "0x"],
                { value: messageFee } // pass a msg.value to pay the LayerZero message fee
            )
        ).to.be.revertedWith("NativeOFTV2: Insufficient msg.value")
    })

    it("sendFrom() - tokens from main to other chain using adapterParam", async function () {
        // ensure they're both allocated initial amounts
        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(0)
        expect(await remoteOFTV2.balanceOf(owner.address)).to.equal(0)

        const amount = ethers.utils.parseUnits("100", 18)
        const messageFee = ethers.utils.parseEther("101") // conversion to units of wei
        await nativeOFTV2.setMinDstGas(remoteChainId, parseInt(await nativeOFTV2.PT_SEND()), 225000)
        const adapterParam = ethers.utils.solidityPack(["uint16", "uint256"], [1, 225000])
        const ownerAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [owner.address])
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
    })

    it("setMinDstGas() - when type is not set on destination chain", async function () {
        const amount = ethers.utils.parseUnits("100", 18)
        const messageFee = ethers.utils.parseEther("101") // conversion to units of wei
        const adapterParam = ethers.utils.solidityPack(["uint16", "uint256"], [1, 225000])
        const ownerAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [owner.address])
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
        const amount = ethers.utils.parseUnits("100", 18)
        const messageFee = ethers.utils.parseEther("101") // conversion to units of wei
        await nativeOFTV2.setMinDstGas(remoteChainId, parseInt(await nativeOFTV2.PT_SEND()), 250000)
        const adapterParam = ethers.utils.solidityPack(["uint16", "uint256"], [1, 225000])
        const ownerAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [owner.address])
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

        const amount = ethers.utils.parseUnits("100", 18)
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

        let amount = ethers.utils.parseUnits("100", 18)
        await nativeOFTV2.deposit({ value: amount })

        let transFee = ownerBalance.sub(await ethers.provider.getBalance(owner.address)).sub(amount)

        expect(await ethers.provider.getBalance(nativeOFTV2.address)).to.equal(amount)
        expect(await ethers.provider.getBalance(owner.address)).to.equal(ownerBalance.sub(amount).sub(transFee))
        expect(await nativeOFTV2.balanceOf(owner.address)).to.equal(amount)

        amount = ethers.utils.parseUnits("150", 18)
        await expect(nativeOFTV2.withdraw(amount)).to.be.revertedWith("NativeOFTV2: Insufficient balance.")
    })
})
