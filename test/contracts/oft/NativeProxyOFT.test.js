const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("NativeProxyOFT20: ", function () {
    const baseChainId = 1
    const otherChainId = 2
    const name = "OmnichainFungibleToken"
    const symbol = "OFT"
    const globalSupply = ethers.utils.parseUnits("1000000", 18)

    let owner, alice, lzEndpointBase, lzEndpointOther, nativeProxyOFT, otherOFT, LZEndpointMock, NativeProxyOFT20, OFT, LzLibFactory, lzLib

    before(async function () {
        owner = (await ethers.getSigners())[0]
        alice = (await ethers.getSigners())[1]
        LZEndpointMock = await ethers.getContractFactory("LZEndpointMock")
        NativeProxyOFT20 = await ethers.getContractFactory("NativeProxyOFT20")
        OFT = await ethers.getContractFactory("OFT20")
    })

    beforeEach(async function () {
        lzEndpointBase = await LZEndpointMock.deploy(baseChainId)
        lzEndpointOther = await LZEndpointMock.deploy(otherChainId)

        expect(await lzEndpointBase.getChainId()).to.equal(baseChainId)
        expect(await lzEndpointOther.getChainId()).to.equal(otherChainId)

        //------  deploy: base & other chain  -------------------------------------------------------
        // create two NativeProxyOFT20 instances. both tokens have the same name and symbol on each chain
        // 1. base chain
        // 2. other chain
        nativeProxyOFT = await NativeProxyOFT20.deploy(name, symbol, lzEndpointBase.address)
        otherOFT = await OFT.deploy(name, symbol, lzEndpointOther.address)

        // internal bookkeeping for endpoints (not part of a real deploy, just for this test)
        lzEndpointBase.setDestLzEndpoint(otherOFT.address, lzEndpointOther.address)
        lzEndpointOther.setDestLzEndpoint(nativeProxyOFT.address, lzEndpointBase.address)

        //------  setTrustedRemote(s) -------------------------------------------------------
        // for each OFT, setTrustedRemote to allow it to receive from the remote OFT contract.
        // Note: This is sometimes referred to as the "wire-up" process.
        await nativeProxyOFT.setTrustedRemote(otherChainId, otherOFT.address)
        await otherOFT.setTrustedRemote(baseChainId, nativeProxyOFT.address)

        await nativeProxyOFT.setUseCustomAdapterParams(true);
        // ... the deployed OFTs are ready now!
    })

    it("sendFrom() - tokens from main to other chain using default", async function () {
        // ensure they're both allocated initial amounts
        let ownerBalance = await ethers.provider.getBalance(owner.address);
        let aliceBalance = await ethers.provider.getBalance(alice.address);
        expect(await nativeProxyOFT.balanceOf(owner.address)).to.equal(0)
        expect(await otherOFT.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeProxyOFT.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseUnits("7", 18)
        await nativeProxyOFT.deposit({ value: depositAmount })

        let transFee_1 = ownerBalance.sub(await ethers.provider.getBalance(owner.address)).sub(depositAmount)

        expect(await nativeProxyOFT.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeProxyOFT.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseUnits("0", 18)
        let sentFee = ethers.utils.parseUnits("2", 18)
        let totalAmount = ethers.utils.parseUnits("8", 18)

        let messageFee = ethers.utils.parseUnits("3", 18) // conversion to units of wei
        await nativeProxyOFT.setUseCustomAdapterParams(false);
        await otherOFT.setUseCustomAdapterParams(false);

        await nativeProxyOFT.sendFrom(
            owner.address,
            otherChainId, // destination chainId
            owner.address, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            owner.address, // LayerZero refund address (if too much fee is sent gets refunded)
            ethers.constants.AddressZero, // future parameter
            "0x", // adapterParameters empty bytes specifies default settings
            { value: messageFee } // pass a msg.value to pay the LayerZero message fee
        )

        let transFee_2 = ownerBalance.sub(await ethers.provider.getBalance(owner.address)).sub(messageFee)

        // expect(await ethers.provider.getBalance(owner.address)).to.be.equal(ownerBalance.sub(messageFee).sub(transFee).sub(depositAmount))
        expect(await ethers.provider.getBalance(nativeProxyOFT.address)).to.be.equal(totalAmount)
        expect(await ethers.provider.getBalance(lzEndpointBase.address)).to.be.equal(ethers.utils.parseUnits("2", 18))
        expect(await ethers.provider.getBalance(lzEndpointOther.address)).to.be.equal(ethers.utils.parseUnits("0", 18))
        expect(await nativeProxyOFT.balanceOf(nativeProxyOFT.address)).to.be.equal(totalAmount)
        expect(await nativeProxyOFT.balanceOf(owner.address)).to.be.equal(leftOverAmount)
        expect(await otherOFT.balanceOf(owner.address)).to.be.equal(totalAmount)

        let ownerBalance2 = await ethers.provider.getBalance(owner.address);
        messageFee = ethers.utils.parseEther("0.01")

        await otherOFT.sendFrom(
            owner.address,
            baseChainId, // destination chainId
            alice.address, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            owner.address, // LayerZero refund address (if too much fee is sent gets refunded)
            ethers.constants.AddressZero, // future parameter
            "0x", // adapterParameters empty bytes specifies default settings
            { value: messageFee } // pass a msg.value to pay the LayerZero message fee
        )

        transFee = ownerBalance2.sub(await ethers.provider.getBalance(owner.address)).sub(messageFee);

        expect(await ethers.provider.getBalance(alice.address)).to.be.equal(aliceBalance.add(totalAmount))
        expect(await ethers.provider.getBalance(owner.address)).to.be.equal(ownerBalance2.sub(messageFee).sub(transFee))
        expect(await nativeProxyOFT.balanceOf(owner.address)).to.equal(leftOverAmount)
        expect(await otherOFT.balanceOf(owner.address)).to.equal(0)
    })

    it("sendFrom() - with enough native", async function () {
        // ensure they're both allocated initial amounts
        let ownerBalance = await ethers.provider.getBalance(owner.address);
        let aliceBalance = await ethers.provider.getBalance(alice.address);
        expect(await nativeProxyOFT.balanceOf(owner.address)).to.equal(0)
        expect(await otherOFT.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeProxyOFT.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseUnits("4", 18)
        await nativeProxyOFT.deposit({ value: depositAmount })

        let transFee_1 = ownerBalance.sub(await ethers.provider.getBalance(owner.address)).sub(depositAmount)

        expect(await nativeProxyOFT.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeProxyOFT.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseUnits("0", 18)
        let sentFee = ethers.utils.parseUnits("2", 18)
        let totalAmount = ethers.utils.parseUnits("4", 18)

        let messageFee = ethers.utils.parseUnits("1", 18) // conversion to units of wei
        await nativeProxyOFT.setUseCustomAdapterParams(false);
        await otherOFT.setUseCustomAdapterParams(false);
        await nativeProxyOFT.sendFrom(
            owner.address,
            otherChainId, // destination chainId
            owner.address, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            owner.address, // LayerZero refund address (if too much fee is sent gets refunded)
            ethers.constants.AddressZero, // future parameter
            "0x", // adapterParameters empty bytes specifies default settings
            { value: messageFee } // pass a msg.value to pay the LayerZero message fee
        )

        expect(await ethers.provider.getBalance(nativeProxyOFT.address)).to.be.equal(totalAmount)
        expect(await ethers.provider.getBalance(lzEndpointBase.address)).to.be.equal(ethers.utils.parseUnits("1", 18))
        expect(await ethers.provider.getBalance(lzEndpointOther.address)).to.be.equal(ethers.utils.parseUnits("0", 18))
        expect(await nativeProxyOFT.balanceOf(nativeProxyOFT.address)).to.be.equal(totalAmount)
        expect(await nativeProxyOFT.balanceOf(owner.address)).to.be.equal(leftOverAmount)
        expect(await otherOFT.balanceOf(owner.address)).to.be.equal(totalAmount)
    })

    it("sendFrom() - from != sender with enough native", async function () {
        // ensure they're both allocated initial amounts
        let ownerBalance = await ethers.provider.getBalance(owner.address);
        let aliceBalance = await ethers.provider.getBalance(alice.address);
        expect(await nativeProxyOFT.balanceOf(owner.address)).to.equal(0)
        expect(await otherOFT.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeProxyOFT.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseUnits("4", 18)
        await nativeProxyOFT.deposit({ value: depositAmount })

        let transFee_1 = ownerBalance.sub(await ethers.provider.getBalance(owner.address)).sub(depositAmount)

        expect(await nativeProxyOFT.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeProxyOFT.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseUnits("0", 18)
        let sentFee = ethers.utils.parseUnits("2", 18)
        let totalAmount = ethers.utils.parseUnits("4", 18)

        // approve the other user to send the tokens
        await nativeProxyOFT.approve(alice.address, totalAmount)

        let messageFee = ethers.utils.parseUnits("1", 18) // conversion to units of wei
        await nativeProxyOFT.setUseCustomAdapterParams(false);
        await otherOFT.setUseCustomAdapterParams(false);
        await nativeProxyOFT.connect(alice).sendFrom(
            owner.address,
            otherChainId, // destination chainId
            owner.address, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            owner.address, // LayerZero refund address (if too much fee is sent gets refunded)
            ethers.constants.AddressZero, // future parameter
            "0x", // adapterParameters empty bytes specifies default settings
            { value: messageFee } // pass a msg.value to pay the LayerZero message fee
        )

        expect(await ethers.provider.getBalance(nativeProxyOFT.address)).to.be.equal(totalAmount)
        expect(await ethers.provider.getBalance(lzEndpointBase.address)).to.be.equal(ethers.utils.parseUnits("1", 18))
        expect(await ethers.provider.getBalance(lzEndpointOther.address)).to.be.equal(ethers.utils.parseUnits("0", 18))
        expect(await nativeProxyOFT.balanceOf(nativeProxyOFT.address)).to.be.equal(totalAmount)
        expect(await nativeProxyOFT.balanceOf(owner.address)).to.be.equal(leftOverAmount)
        expect(await otherOFT.balanceOf(owner.address)).to.be.equal(totalAmount)
    })

    it("sendFrom() - from != sender with addition msg.value", async function () {
        // ensure they're both allocated initial amounts
        let ownerBalance = await ethers.provider.getBalance(owner.address);
        let aliceBalance = await ethers.provider.getBalance(alice.address);
        expect(await nativeProxyOFT.balanceOf(owner.address)).to.equal(0)
        expect(await otherOFT.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeProxyOFT.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseUnits("3", 18)
        await nativeProxyOFT.deposit({ value: depositAmount })

        let transFee_1 = ownerBalance.sub(await ethers.provider.getBalance(owner.address)).sub(depositAmount)

        expect(await nativeProxyOFT.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeProxyOFT.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseUnits("0", 18)
        let sentFee = ethers.utils.parseUnits("2", 18)
        let totalAmount = ethers.utils.parseUnits("4", 18)

        // approve the other user to send the tokens
        await nativeProxyOFT.approve(alice.address, totalAmount)

        let messageFee = ethers.utils.parseUnits("2", 18) // conversion to units of wei
        await nativeProxyOFT.setUseCustomAdapterParams(false);
        await otherOFT.setUseCustomAdapterParams(false);
        await nativeProxyOFT.connect(alice).sendFrom(
            owner.address,
            otherChainId, // destination chainId
            owner.address, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            owner.address, // LayerZero refund address (if too much fee is sent gets refunded)
            ethers.constants.AddressZero, // future parameter
            "0x", // adapterParameters empty bytes specifies default settings
            { value: messageFee } // pass a msg.value to pay the LayerZero message fee
        )

        expect(await ethers.provider.getBalance(nativeProxyOFT.address)).to.be.equal(totalAmount)
        expect(await ethers.provider.getBalance(lzEndpointBase.address)).to.be.equal(ethers.utils.parseUnits("1", 18))
        expect(await ethers.provider.getBalance(lzEndpointOther.address)).to.be.equal(ethers.utils.parseUnits("0", 18))
        expect(await nativeProxyOFT.balanceOf(nativeProxyOFT.address)).to.be.equal(totalAmount)
        expect(await nativeProxyOFT.balanceOf(owner.address)).to.be.equal(leftOverAmount)
        expect(await otherOFT.balanceOf(owner.address)).to.be.equal(totalAmount)
    })

    it("sendFrom() - from != sender with not enough native", async function () {
        // ensure they're both allocated initial amounts
        let ownerBalance = await ethers.provider.getBalance(owner.address);
        let aliceBalance = await ethers.provider.getBalance(alice.address);
        expect(await nativeProxyOFT.balanceOf(owner.address)).to.equal(0)
        expect(await otherOFT.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeProxyOFT.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseUnits("4", 18)
        await nativeProxyOFT.deposit({ value: depositAmount })

        let transFee_1 = ownerBalance.sub(await ethers.provider.getBalance(owner.address)).sub(depositAmount)

        expect(await nativeProxyOFT.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeProxyOFT.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseUnits("0", 18)
        let sentFee = ethers.utils.parseUnits("2", 18)
        let totalAmount = ethers.utils.parseUnits("5", 18)

        // approve the other user to send the tokens
        await nativeProxyOFT.approve(alice.address, totalAmount)

        let messageFee = ethers.utils.parseUnits("0.5", 18) // conversion to units of wei
        await nativeProxyOFT.setUseCustomAdapterParams(false);
        await otherOFT.setUseCustomAdapterParams(false);
        await expect (nativeProxyOFT.connect(alice).sendFrom(
            owner.address,
            otherChainId, // destination chainId
            owner.address, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            owner.address, // LayerZero refund address (if too much fee is sent gets refunded)
            ethers.constants.AddressZero, // future parameter
            "0x", // adapterParameters empty bytes specifies default settings
            { value: messageFee } // pass a msg.value to pay the LayerZero message fee
        )).to.be.revertedWith("NativeProxyOFT20: Insufficient msg.value")
    })

    it("sendFrom() - from != sender not approved expect revert", async function () {
        // ensure they're both allocated initial amounts
        let ownerBalance = await ethers.provider.getBalance(owner.address);
        let aliceBalance = await ethers.provider.getBalance(alice.address);
        expect(await nativeProxyOFT.balanceOf(owner.address)).to.equal(0)
        expect(await otherOFT.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeProxyOFT.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseUnits("4", 18)
        await nativeProxyOFT.deposit({ value: depositAmount })

        let transFee_1 = ownerBalance.sub(await ethers.provider.getBalance(owner.address)).sub(depositAmount)

        expect(await nativeProxyOFT.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeProxyOFT.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseUnits("0", 18)
        let sentFee = ethers.utils.parseUnits("2", 18)
        let totalAmount = ethers.utils.parseUnits("4", 18)

        // approve the other user to send the tokens
        // await nativeProxyOFT.approve(alice.address, totalAmount)

        let messageFee = ethers.utils.parseUnits("1", 18) // conversion to units of wei
        await nativeProxyOFT.setUseCustomAdapterParams(false);
        await otherOFT.setUseCustomAdapterParams(false);
        await expect (nativeProxyOFT.connect(alice).sendFrom(
            owner.address,
            otherChainId, // destination chainId
            owner.address, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            owner.address, // LayerZero refund address (if too much fee is sent gets refunded)
            ethers.constants.AddressZero, // future parameter
            "0x", // adapterParameters empty bytes specifies default settings
            { value: messageFee } // pass a msg.value to pay the LayerZero message fee
        )).to.be.revertedWith("ERC20: insufficient allowance")
    })

    it("sendFrom() - with insufficient value and expect revert", async function () {
        // ensure they're both allocated initial amounts
        let ownerBalance = await ethers.provider.getBalance(owner.address);
        let aliceBalance = await ethers.provider.getBalance(alice.address);
        expect(await nativeProxyOFT.balanceOf(owner.address)).to.equal(0)
        expect(await otherOFT.balanceOf(owner.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeProxyOFT.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseUnits("4", 18)
        await nativeProxyOFT.deposit({ value: depositAmount })

        let transFee_1 = ownerBalance.sub(await ethers.provider.getBalance(owner.address)).sub(depositAmount)

        expect(await nativeProxyOFT.balanceOf(owner.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeProxyOFT.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseUnits("0", 18)
        let sentFee = ethers.utils.parseUnits("2", 18)
        let totalAmount = ethers.utils.parseUnits("8", 18)

        let messageFee = ethers.utils.parseUnits("3", 18) // conversion to units of wei
        await nativeProxyOFT.setUseCustomAdapterParams(false);
        await otherOFT.setUseCustomAdapterParams(false);
        await expect(nativeProxyOFT.sendFrom(
            owner.address,
            otherChainId, // destination chainId
            owner.address, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            owner.address, // LayerZero refund address (if too much fee is sent gets refunded)
            ethers.constants.AddressZero, // future parameter
            "0x", // adapterParameters empty bytes specifies default settings
            { value: messageFee } // pass a msg.value to pay the LayerZero message fee
        )).to.be.revertedWith("NativeProxyOFT20: Insufficient msg.value")
    })

    it("sendFrom() - tokens from main to other chain using adapterParam", async function () {
        // ensure they're both allocated initial amounts
        expect(await nativeProxyOFT.balanceOf(owner.address)).to.equal(0)
        expect(await otherOFT.balanceOf(owner.address)).to.equal(0)

        const amount = ethers.utils.parseUnits("100", 18)
        const messageFee = ethers.utils.parseEther("101") // conversion to units of wei
        await nativeProxyOFT.setMinDstGasLookup(otherChainId, parseInt(await nativeProxyOFT.FUNCTION_TYPE_SEND()), 225000)
        const adapterParam = ethers.utils.solidityPack(["uint16", "uint256"], [1, 225000])

        await nativeProxyOFT.sendFrom(
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
        expect(await nativeProxyOFT.balanceOf(nativeProxyOFT.address)).to.be.equal(amount)
        expect(await otherOFT.balanceOf(owner.address)).to.be.equal(amount)
    })

    it("setMinDstGasLookup() - when type is not set on destination chain", async function () {
        const amount = ethers.utils.parseUnits("100", 18)
        const messageFee = ethers.utils.parseEther("101") // conversion to units of wei
        const adapterParam = ethers.utils.solidityPack(["uint16", "uint256"], [1, 225000])
        await expect(
            nativeProxyOFT.sendFrom(
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
        await nativeProxyOFT.setMinDstGasLookup(otherChainId, parseInt(await nativeProxyOFT.FUNCTION_TYPE_SEND()), 250000)
        const adapterParam = ethers.utils.solidityPack(["uint16", "uint256"], [1, 225000])
        await expect(
            nativeProxyOFT.sendFrom(
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
        let ownerBalance = await ethers.provider.getBalance(owner.address);
        expect(await ethers.provider.getBalance(nativeProxyOFT.address)).to.equal(0)
        expect(await nativeProxyOFT.balanceOf(owner.address)).to.equal(0)

        const amount = ethers.utils.parseUnits("100", 18)
        await nativeProxyOFT.deposit({ value: amount })

        let transFee = ownerBalance.sub(await ethers.provider.getBalance(owner.address)).sub(amount)

        expect(await ethers.provider.getBalance(nativeProxyOFT.address)).to.equal(amount)
        expect(await ethers.provider.getBalance(owner.address)).to.equal(ownerBalance.sub(amount).sub(transFee))
        expect(await nativeProxyOFT.balanceOf(owner.address)).to.equal(amount)

        await nativeProxyOFT.withdraw(amount)
        transFee = ownerBalance.sub(await ethers.provider.getBalance(owner.address))

        expect(await ethers.provider.getBalance(nativeProxyOFT.address)).to.equal(0)
        expect(await ethers.provider.getBalance(owner.address)).to.equal(ownerBalance.sub(transFee))
        expect(await nativeProxyOFT.balanceOf(owner.address)).to.equal(0)
    })

    it("wrap() and unwrap() expect revert", async function () {
        let ownerBalance = await ethers.provider.getBalance(owner.address);
        expect(await ethers.provider.getBalance(nativeProxyOFT.address)).to.equal(0)
        expect(await nativeProxyOFT.balanceOf(owner.address)).to.equal(0)

        let amount = ethers.utils.parseUnits("100", 18)
        await nativeProxyOFT.deposit({ value: amount })

        let transFee = ownerBalance.sub(await ethers.provider.getBalance(owner.address)).sub(amount)

        expect(await ethers.provider.getBalance(nativeProxyOFT.address)).to.equal(amount)
        expect(await ethers.provider.getBalance(owner.address)).to.equal(ownerBalance.sub(amount).sub(transFee))
        expect(await nativeProxyOFT.balanceOf(owner.address)).to.equal(amount)

        amount = ethers.utils.parseUnits("150", 18)
        await expect(nativeProxyOFT.withdraw(amount)).to.be.revertedWith("NativeProxyOFT20: Insufficient balance.")
    })
})
