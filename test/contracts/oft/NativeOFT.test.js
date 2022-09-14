const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("NativeOFT: ", function () {
    const baseChainId = 1
    const otherChainId = 2
    const name = "OmnichainFungibleToken"
    const symbol = "OFT"

    let owner, alice, lzEndpointBase, lzEndpointOther, nativeOFT, otherOFT, LZEndpointMock, NativeOFT, OFT

    before(async function () {
        owner = (await ethers.getSigners())[0]
        alice = (await ethers.getSigners())[1]
        LZEndpointMock = await ethers.getContractFactory("LZEndpointMock")
        NativeOFT = await ethers.getContractFactory("NativeOFT")
        OFT = await ethers.getContractFactory("OFT")
    })

    beforeEach(async function () {
        lzEndpointBase = await LZEndpointMock.deploy(baseChainId)
        lzEndpointOther = await LZEndpointMock.deploy(otherChainId)

        expect(await lzEndpointBase.getChainId()).to.equal(baseChainId)
        expect(await lzEndpointOther.getChainId()).to.equal(otherChainId)

        //------  deploy: base & other chain  -------------------------------------------------------
        // create two NativeOFT instances. both tokens have the same name and symbol on each chain
        // 1. base chain
        // 2. other chain
        nativeOFT = await NativeOFT.deploy(name, symbol, lzEndpointBase.address)
        otherOFT = await OFT.deploy(name, symbol, lzEndpointOther.address)

        // internal bookkeeping for endpoints (not part of a real deploy, just for this test)
        await lzEndpointBase.setDestLzEndpoint(otherOFT.address, lzEndpointOther.address)
        await lzEndpointOther.setDestLzEndpoint(nativeOFT.address, lzEndpointBase.address)

        //------  setTrustedRemote(s) -------------------------------------------------------
        // for each OFT, setTrustedRemote to allow it to receive from the remote OFT contract.
        // Note: This is sometimes referred to as the "wire-up" process.
        await nativeOFT.setTrustedRemote(otherChainId, ethers.utils.solidityPack(["address", "address"], [otherOFT.address, nativeOFT.address]))
        await otherOFT.setTrustedRemote(baseChainId, ethers.utils.solidityPack(["address", "address"], [nativeOFT.address, otherOFT.address]))

        await nativeOFT.setUseCustomAdapterParams(true)
        // ... the deployed OFTs are ready now!
    })

    it("sendFrom() - tokens from main to other chain using default", async function () {
        expect(await ethers.provider.getBalance(lzEndpointBase.address)).to.be.equal(ethers.utils.parseUnits("0", 18))

        await nativeOFT.setUseCustomAdapterParams(false)
        await otherOFT.setUseCustomAdapterParams(false)

        // ensure they're both allocated initial amounts
        let aliceBalance = await ethers.provider.getBalance(alice.address)
        expect(await nativeOFT.balanceOf(owner.address)).to.equal(0)
        expect(await otherOFT.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseUnits("7", 18)
        await nativeOFT.deposit({ value: depositAmount })

        expect(await nativeOFT.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseUnits("0", 18)
        let totalAmount = ethers.utils.parseUnits("8", 18)

        // estimate nativeFees
        let nativeFee = (await nativeOFT.estimateSendFee(otherChainId, owner.address, totalAmount, false, "0x")).nativeFee

        expect(await ethers.provider.getBalance(lzEndpointBase.address)).to.be.equal(ethers.utils.parseUnits("0", 18))

        await nativeOFT.sendFrom(
            owner.address,
            otherChainId, // destination chainId
            owner.address, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            owner.address, // LayerZero refund address (if too much fee is sent gets refunded)
            ethers.constants.AddressZero, // future parameter
            "0x", // adapterParameters empty bytes specifies default settings
            { value: nativeFee.add(totalAmount.sub(depositAmount)) } // pass a msg.value to pay the LayerZero message fee
        )

        // expect(await ethers.provider.getBalance(owner.address)).to.be.equal(ownerBalance.sub(messageFee).sub(transFee).sub(depositAmount))
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(totalAmount)
        expect(await ethers.provider.getBalance(lzEndpointBase.address)).to.be.equal(nativeFee) // collects
        expect(await nativeOFT.balanceOf(nativeOFT.address)).to.be.equal(totalAmount)
        expect(await nativeOFT.balanceOf(owner.address)).to.be.equal(leftOverAmount)
        expect(await otherOFT.balanceOf(owner.address)).to.be.equal(totalAmount)

        let ownerBalance2 = await ethers.provider.getBalance(owner.address)

        // estimate nativeFees
        nativeFee = (await nativeOFT.estimateSendFee(baseChainId, owner.address, totalAmount, false, "0x")).nativeFee

        await otherOFT.sendFrom(
            owner.address,
            baseChainId, // destination chainId
            alice.address, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            owner.address, // LayerZero refund address (if too much fee is sent gets refunded)
            ethers.constants.AddressZero, // future parameter
            "0x", // adapterParameters empty bytes specifies default settings
            { value: nativeFee.add(totalAmount) } // pass a msg.value to pay the LayerZero message fee
        )

        let transFee = ownerBalance2.sub(await ethers.provider.getBalance(owner.address)).sub(nativeFee)
        expect(await ethers.provider.getBalance(alice.address)).to.be.equal(aliceBalance.add(totalAmount))
        expect(await ethers.provider.getBalance(owner.address)).to.be.equal(ownerBalance2.sub(nativeFee).sub(transFee))
        expect(await nativeOFT.balanceOf(owner.address)).to.equal(leftOverAmount)
        expect(await otherOFT.balanceOf(owner.address)).to.equal(0)
    })

    it("sendFrom() - with enough native", async function () {
        await nativeOFT.setUseCustomAdapterParams(false)
        await otherOFT.setUseCustomAdapterParams(false)

        // ensure they're both allocated initial amounts
        let ownerBalance = await ethers.provider.getBalance(owner.address)
        let aliceBalance = await ethers.provider.getBalance(alice.address)
        expect(await nativeOFT.balanceOf(owner.address)).to.equal(0)
        expect(await otherOFT.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseUnits("4", 18)
        await nativeOFT.deposit({ value: depositAmount })

        let transFee_1 = ownerBalance.sub(await ethers.provider.getBalance(owner.address)).sub(depositAmount)

        expect(await nativeOFT.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseUnits("0", 18)
        let sentFee = ethers.utils.parseUnits("2", 18)
        let totalAmount = ethers.utils.parseUnits("4", 18)

        let messageFee = ethers.utils.parseUnits("1", 18) // conversion to units of wei

        // estimate nativeFees
        let nativeFee = (await nativeOFT.estimateSendFee(otherChainId, owner.address, totalAmount, false, "0x")).nativeFee

        await nativeOFT.sendFrom(
            owner.address,
            otherChainId, // destination chainId
            owner.address, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            owner.address, // LayerZero refund address (if too much fee is sent gets refunded)
            ethers.constants.AddressZero, // future parameter
            "0x", // adapterParameters empty bytes specifies default settings
            { value: nativeFee.add(totalAmount.sub(depositAmount)) } // pass a msg.value to pay the LayerZero message fee
        )

        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(totalAmount)
        expect(await ethers.provider.getBalance(lzEndpointBase.address)).to.be.equal(nativeFee)
        expect(await ethers.provider.getBalance(lzEndpointOther.address)).to.be.equal(ethers.utils.parseUnits("0", 18))
        expect(await nativeOFT.balanceOf(nativeOFT.address)).to.be.equal(totalAmount)
        expect(await nativeOFT.balanceOf(owner.address)).to.be.equal(leftOverAmount)
        expect(await otherOFT.balanceOf(owner.address)).to.be.equal(totalAmount)
    })

    it("sendFrom() - from != sender with enough native", async function () {
        await nativeOFT.setUseCustomAdapterParams(false)
        await otherOFT.setUseCustomAdapterParams(false)

        // ensure they're both allocated initial amounts
        expect(await nativeOFT.balanceOf(owner.address)).to.equal(0)
        expect(await otherOFT.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseUnits("4", 18)
        await nativeOFT.deposit({ value: depositAmount })

        expect(await nativeOFT.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseUnits("0", 18)
        let totalAmount = ethers.utils.parseUnits("4", 18)

        // approve the other user to send the tokens
        await nativeOFT.approve(alice.address, totalAmount)

        // estimate nativeFees
        let nativeFee = (await nativeOFT.estimateSendFee(otherChainId, owner.address, totalAmount, false, "0x")).nativeFee

        await nativeOFT.connect(alice).sendFrom(
            owner.address,
            otherChainId, // destination chainId
            owner.address, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            owner.address, // LayerZero refund address (if too much fee is sent gets refunded)
            ethers.constants.AddressZero, // future parameter
            "0x", // adapterParameters empty bytes specifies default settings
            { value: nativeFee.add(totalAmount.sub(depositAmount)) } // pass a msg.value to pay the LayerZero message fee
        )

        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(totalAmount)
        expect(await ethers.provider.getBalance(lzEndpointBase.address)).to.be.equal(nativeFee)
        expect(await ethers.provider.getBalance(lzEndpointOther.address)).to.be.equal(ethers.utils.parseUnits("0", 18))
        expect(await nativeOFT.balanceOf(nativeOFT.address)).to.be.equal(totalAmount)
        expect(await nativeOFT.balanceOf(owner.address)).to.be.equal(leftOverAmount)
        expect(await otherOFT.balanceOf(owner.address)).to.be.equal(totalAmount)
    })

    it("sendFrom() - from != sender with addition msg.value", async function () {
        await nativeOFT.setUseCustomAdapterParams(false)
        await otherOFT.setUseCustomAdapterParams(false)

        // ensure they're both allocated initial amounts
        expect(await nativeOFT.balanceOf(owner.address)).to.equal(0)
        expect(await otherOFT.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseUnits("3", 18)
        await nativeOFT.deposit({ value: depositAmount })

        expect(await nativeOFT.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseUnits("0", 18)
        let sentFee = ethers.utils.parseUnits("2", 18)
        let totalAmount = ethers.utils.parseUnits("4", 18)

        // approve the other user to send the tokens
        await nativeOFT.approve(alice.address, totalAmount)

        // estimate nativeFees
        let nativeFee = (await nativeOFT.estimateSendFee(otherChainId, owner.address, totalAmount, false, "0x")).nativeFee

        await nativeOFT.connect(alice).sendFrom(
            owner.address,
            otherChainId, // destination chainId
            owner.address, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            owner.address, // LayerZero refund address (if too much fee is sent gets refunded)
            ethers.constants.AddressZero, // future parameter
            "0x", // adapterParameters empty bytes specifies default settings
            { value: nativeFee.add(totalAmount.sub(depositAmount)) } // pass a msg.value to pay the LayerZero message fee
        )

        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(totalAmount)
        expect(await ethers.provider.getBalance(lzEndpointBase.address)).to.be.equal(nativeFee)
        expect(await ethers.provider.getBalance(lzEndpointOther.address)).to.be.equal(ethers.utils.parseUnits("0", 18))
        expect(await nativeOFT.balanceOf(nativeOFT.address)).to.be.equal(totalAmount)
        expect(await nativeOFT.balanceOf(owner.address)).to.be.equal(leftOverAmount)
        expect(await otherOFT.balanceOf(owner.address)).to.be.equal(totalAmount)
    })

    it("sendFrom() - from != sender with not enough native", async function () {
        // ensure they're both allocated initial amounts
        let ownerBalance = await ethers.provider.getBalance(owner.address)
        let aliceBalance = await ethers.provider.getBalance(alice.address)
        expect(await nativeOFT.balanceOf(owner.address)).to.equal(0)
        expect(await otherOFT.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseUnits("4", 18)
        await nativeOFT.deposit({ value: depositAmount })

        let transFee_1 = ownerBalance.sub(await ethers.provider.getBalance(owner.address)).sub(depositAmount)

        expect(await nativeOFT.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseUnits("0", 18)
        let sentFee = ethers.utils.parseUnits("2", 18)
        let totalAmount = ethers.utils.parseUnits("5", 18)

        // approve the other user to send the tokens
        await nativeOFT.approve(alice.address, totalAmount)

        let messageFee = ethers.utils.parseUnits("0.5", 18) // conversion to units of wei
        await nativeOFT.setUseCustomAdapterParams(false)
        await otherOFT.setUseCustomAdapterParams(false)
        await expect(
            nativeOFT.connect(alice).sendFrom(
                owner.address,
                otherChainId, // destination chainId
                owner.address, // destination address to send tokens to
                totalAmount, // quantity of tokens to send (in units of wei)
                owner.address, // LayerZero refund address (if too much fee is sent gets refunded)
                ethers.constants.AddressZero, // future parameter
                "0x", // adapterParameters empty bytes specifies default settings
                { value: messageFee } // pass a msg.value to pay the LayerZero message fee
            )
        ).to.be.revertedWith("NativeOFT: Insufficient msg.value")
    })

    it("sendFrom() - from != sender not approved expect revert", async function () {
        // ensure they're both allocated initial amounts
        let ownerBalance = await ethers.provider.getBalance(owner.address)
        let aliceBalance = await ethers.provider.getBalance(alice.address)
        expect(await nativeOFT.balanceOf(owner.address)).to.equal(0)
        expect(await otherOFT.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseUnits("4", 18)
        await nativeOFT.deposit({ value: depositAmount })

        let transFee_1 = ownerBalance.sub(await ethers.provider.getBalance(owner.address)).sub(depositAmount)

        expect(await nativeOFT.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseUnits("0", 18)
        let sentFee = ethers.utils.parseUnits("2", 18)
        let totalAmount = ethers.utils.parseUnits("4", 18)

        // approve the other user to send the tokens
        // await nativeOFT.approve(alice.address, totalAmount)

        let messageFee = ethers.utils.parseUnits("1", 18) // conversion to units of wei
        await nativeOFT.setUseCustomAdapterParams(false)
        await otherOFT.setUseCustomAdapterParams(false)
        await expect(
            nativeOFT.connect(alice).sendFrom(
                owner.address,
                otherChainId, // destination chainId
                owner.address, // destination address to send tokens to
                totalAmount, // quantity of tokens to send (in units of wei)
                owner.address, // LayerZero refund address (if too much fee is sent gets refunded)
                ethers.constants.AddressZero, // future parameter
                "0x", // adapterParameters empty bytes specifies default settings
                { value: messageFee } // pass a msg.value to pay the LayerZero message fee
            )
        ).to.be.revertedWith("ERC20: insufficient allowance")
    })

    it("sendFrom() - with insufficient value and expect revert", async function () {
        // ensure they're both allocated initial amounts
        let ownerBalance = await ethers.provider.getBalance(owner.address)
        let aliceBalance = await ethers.provider.getBalance(alice.address)
        expect(await nativeOFT.balanceOf(owner.address)).to.equal(0)
        expect(await otherOFT.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseUnits("4", 18)
        await nativeOFT.deposit({ value: depositAmount })

        let transFee_1 = ownerBalance.sub(await ethers.provider.getBalance(owner.address)).sub(depositAmount)

        expect(await nativeOFT.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseUnits("0", 18)
        let sentFee = ethers.utils.parseUnits("2", 18)
        let totalAmount = ethers.utils.parseUnits("8", 18)

        let messageFee = ethers.utils.parseUnits("3", 18) // conversion to units of wei
        await nativeOFT.setUseCustomAdapterParams(false)
        await otherOFT.setUseCustomAdapterParams(false)
        await expect(
            nativeOFT.sendFrom(
                owner.address,
                otherChainId, // destination chainId
                owner.address, // destination address to send tokens to
                totalAmount, // quantity of tokens to send (in units of wei)
                owner.address, // LayerZero refund address (if too much fee is sent gets refunded)
                ethers.constants.AddressZero, // future parameter
                "0x", // adapterParameters empty bytes specifies default settings
                { value: messageFee } // pass a msg.value to pay the LayerZero message fee
            )
        ).to.be.revertedWith("NativeOFT: Insufficient msg.value")
    })

    it("sendFrom() - tokens from main to other chain using adapterParam", async function () {
        // ensure they're both allocated initial amounts
        expect(await nativeOFT.balanceOf(owner.address)).to.equal(0)
        expect(await otherOFT.balanceOf(owner.address)).to.equal(0)

        const amount = ethers.utils.parseUnits("100", 18)
        const messageFee = ethers.utils.parseEther("101") // conversion to units of wei
        await nativeOFT.setMinDstGasLookup(otherChainId, parseInt(await nativeOFT.FUNCTION_TYPE_SEND()), 225000)
        const adapterParam = ethers.utils.solidityPack(["uint16", "uint256"], [1, 225000])

        await nativeOFT.sendFrom(
            owner.address,
            otherChainId, // destination chainId
            owner.address, // destination address to send tokens to
            amount, // quantity of tokens to send (in units of wei)
            owner.address, // LayerZero refund address (if too much fee is sent gets refunded)
            ethers.constants.AddressZero, // future parameter
            adapterParam, // adapterParameters empty bytes specifies default settings
            { value: messageFee } // pass a msg.value to pay the LayerZero message fee
        )

        // verify tokens burned on source chain and minted on destination chain
        expect(await nativeOFT.balanceOf(nativeOFT.address)).to.be.equal(amount)
        expect(await otherOFT.balanceOf(owner.address)).to.be.equal(amount)
    })

    it("setMinDstGasLookup() - when type is not set on destination chain", async function () {
        const amount = ethers.utils.parseUnits("100", 18)
        const messageFee = ethers.utils.parseEther("101") // conversion to units of wei
        const adapterParam = ethers.utils.solidityPack(["uint16", "uint256"], [1, 225000])
        await expect(
            nativeOFT.sendFrom(
                owner.address,
                otherChainId, // destination chainId
                owner.address, // destination address to send tokens to
                amount, // quantity of tokens to send (in units of wei)
                owner.address, // LayerZero refund address (if too much fee is sent gets refunded)
                ethers.constants.AddressZero, // future parameter
                adapterParam, // adapterParameters empty bytes specifies default settings
                { value: messageFee } // pass a msg.value to pay the LayerZero message fee
            )
        ).to.be.revertedWith("LzApp: minGasLimit not set")
    })

    it("setMinDstGasLookup() - set min dst gas higher than what we are sending and expect revert", async function () {
        const amount = ethers.utils.parseUnits("100", 18)
        const messageFee = ethers.utils.parseEther("101") // conversion to units of wei
        await nativeOFT.setMinDstGasLookup(otherChainId, parseInt(await nativeOFT.FUNCTION_TYPE_SEND()), 250000)
        const adapterParam = ethers.utils.solidityPack(["uint16", "uint256"], [1, 225000])
        await expect(
            nativeOFT.sendFrom(
                owner.address,
                otherChainId, // destination chainId
                owner.address, // destination address to send tokens to
                amount, // quantity of tokens to send (in units of wei)
                owner.address, // LayerZero refund address (if too much fee is sent gets refunded)
                ethers.constants.AddressZero, // future parameter
                adapterParam, // adapterParameters empty bytes specifies default settings
                { value: messageFee } // pass a msg.value to pay the LayerZero message fee
            )
        ).to.be.revertedWith("LzApp: gas limit is too low")
    })

    it("wrap() and unwrap()", async function () {
        let ownerBalance = await ethers.provider.getBalance(owner.address)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.equal(0)
        expect(await nativeOFT.balanceOf(owner.address)).to.equal(0)

        const amount = ethers.utils.parseUnits("100", 18)
        await nativeOFT.deposit({ value: amount })

        let transFee = ownerBalance.sub(await ethers.provider.getBalance(owner.address)).sub(amount)

        expect(await ethers.provider.getBalance(nativeOFT.address)).to.equal(amount)
        expect(await ethers.provider.getBalance(owner.address)).to.equal(ownerBalance.sub(amount).sub(transFee))
        expect(await nativeOFT.balanceOf(owner.address)).to.equal(amount)

        await nativeOFT.withdraw(amount)
        transFee = ownerBalance.sub(await ethers.provider.getBalance(owner.address))

        expect(await ethers.provider.getBalance(nativeOFT.address)).to.equal(0)
        expect(await ethers.provider.getBalance(owner.address)).to.equal(ownerBalance.sub(transFee))
        expect(await nativeOFT.balanceOf(owner.address)).to.equal(0)
    })

    it("wrap() and unwrap() expect revert", async function () {
        let ownerBalance = await ethers.provider.getBalance(owner.address)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.equal(0)
        expect(await nativeOFT.balanceOf(owner.address)).to.equal(0)

        let amount = ethers.utils.parseUnits("100", 18)
        await nativeOFT.deposit({ value: amount })

        let transFee = ownerBalance.sub(await ethers.provider.getBalance(owner.address)).sub(amount)

        expect(await ethers.provider.getBalance(nativeOFT.address)).to.equal(amount)
        expect(await ethers.provider.getBalance(owner.address)).to.equal(ownerBalance.sub(amount).sub(transFee))
        expect(await nativeOFT.balanceOf(owner.address)).to.equal(amount)

        amount = ethers.utils.parseUnits("150", 18)
        await expect(nativeOFT.withdraw(amount)).to.be.revertedWith("NativeOFT: Insufficient balance.")
    })
})
