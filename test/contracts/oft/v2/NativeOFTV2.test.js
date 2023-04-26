const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("NativeOFT v2: ", function () {
    const baseChainId = 1
    const otherChainId = 2
    const name = "OmnichainFungibleToken"
    const symbol = "OFT"
    const sharedDecimals = 5

    let LZEndpointMock, NativeOFTV2, OFTV2
    let lzEndpointBase, lzEndpointOther, nativeOFT, otherOFT
    let owner, alice, bob

    before(async function () {
        owner = (await ethers.getSigners())[0]
        alice = (await ethers.getSigners())[1]
        bob = (await ethers.getSigners())[2]
        LZEndpointMock = await ethers.getContractFactory("LZEndpointMock")
        NativeOFTV2 = await ethers.getContractFactory("NativeOFTV2")
        OFTV2 = await ethers.getContractFactory("OFTV2")
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
        nativeOFT = await NativeOFTV2.deploy(name, symbol, sharedDecimals, lzEndpointBase.address)
        otherOFT = await OFTV2.deploy(name, symbol, sharedDecimals, lzEndpointOther.address)


        // internal bookkeeping for endpoints (not part of a real deploy, just for this test)
        await lzEndpointBase.setDestLzEndpoint(otherOFT.address, lzEndpointOther.address)
        await lzEndpointOther.setDestLzEndpoint(nativeOFT.address, lzEndpointBase.address)

        //------  setTrustedRemote(s) -------------------------------------------------------
        // for each OFT, setTrustedRemote to allow it to receive from the remote OFT contract.
        // Note: This is sometimes referred to as the "wire-up" process.
        await nativeOFT.setTrustedRemoteAddress(otherChainId, otherOFT.address)
        await otherOFT.setTrustedRemoteAddress(baseChainId, nativeOFT.address)

        await nativeOFT.setUseCustomAdapterParams(true)
        // ... the deployed OFTs are ready now!
    })

    it("sendFrom() - tokens from main to other chain using default", async function () {
        // ----------------------- Test set up, load address balances -----------------------

        expect(await ethers.provider.getBalance(lzEndpointBase.address)).to.be.equal(ethers.utils.parseUnits("0", 18))

        await nativeOFT.setUseCustomAdapterParams(false)
        await otherOFT.setUseCustomAdapterParams(false)

        // ensure alice is allocated initial amount
        expect(await nativeOFT.balanceOf(alice.address)).to.equal(0)
        expect(await otherOFT.balanceOf(alice.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseUnits("7", 18)
        await nativeOFT.connect(alice).deposit({ value: depositAmount })

        expect(await nativeOFT.balanceOf(alice.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(depositAmount)

        // ensure bob is allocated initial amount
        expect(await nativeOFT.balanceOf(bob.address)).to.equal(0)
        expect(await otherOFT.balanceOf(bob.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(depositAmount)

        await nativeOFT.connect(bob).deposit({ value: depositAmount })

        expect(await nativeOFT.balanceOf(bob.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(depositAmount.mul(2))

        let leftOverAmount = ethers.utils.parseUnits("0", 18)
        let totalAmount = ethers.utils.parseUnits("8", 18)

        // ------------ Alice on native chain sends tokens to Bob on other chain  ------------
        
        const bobAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [bob.address])
        let nativeFee = (await nativeOFT.estimateSendFee(otherChainId, bobAddressBytes32, totalAmount, false, "0x")).nativeFee

        await nativeOFT.connect(alice).sendFrom(
            alice.address,
            otherChainId, // destination chainId
            bobAddressBytes32, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            [alice.address, ethers.constants.AddressZero, "0x"], // callParams: refund to alice
            { value: nativeFee.add(totalAmount.sub(depositAmount)) } // pass a msg.value to pay the LayerZero message fee
        )

        // expect(await ethers.provider.getBalance(owner.address)).to.be.equal(ownerBalance.sub(messageFee).sub(transFee).sub(depositAmount))
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(totalAmount.add(depositAmount))
        expect(await ethers.provider.getBalance(lzEndpointBase.address)).to.be.equal(nativeFee) // collects
        expect(await nativeOFT.balanceOf(nativeOFT.address)).to.be.equal(totalAmount)
        expect(await nativeOFT.balanceOf(alice.address)).to.be.equal(leftOverAmount)
        expect(await otherOFT.balanceOf(bob.address)).to.be.equal(totalAmount)

        // ------------ Bob on other chain sends tokens to Alice on native chain  ------------

        let bobBalance = await ethers.provider.getBalance(bob.address)
        let aliceBalance = await ethers.provider.getBalance(alice.address)

        // estimate nativeFees
        const aliceAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [alice.address])
        nativeFee = (await nativeOFT.estimateSendFee(baseChainId, aliceAddressBytes32, totalAmount, false, "0x")).nativeFee

        await otherOFT.connect(bob).sendFrom(
            bob.address,
            baseChainId, // destination chainId
            aliceAddressBytes32, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            [bob.address, ethers.constants.AddressZero, "0x"], // callParams: refund to bob
            { value: nativeFee.add(totalAmount) } // pass a msg.value to pay the LayerZero message fee
        )

        let transFee = bobBalance.sub(await ethers.provider.getBalance(bob.address)).sub(nativeFee)
        expect(await ethers.provider.getBalance(alice.address)).to.be.equal(aliceBalance.add(totalAmount))
        expect(await ethers.provider.getBalance(bob.address)).to.be.equal(bobBalance.sub(nativeFee).sub(transFee))
        expect(await nativeOFT.balanceOf(bob.address)).to.equal(depositAmount)
        expect(await otherOFT.balanceOf(bob.address)).to.equal(0)
    })

    it("sendFrom() - with enough native", async function () {
        await nativeOFT.setUseCustomAdapterParams(false)
        await otherOFT.setUseCustomAdapterParams(false)

        // ensure they're both allocated initial amounts
        let bobBalance = await ethers.provider.getBalance(bob.address)
        let aliceBalance = await ethers.provider.getBalance(alice.address)
        expect(await nativeOFT.balanceOf(bob.address)).to.equal(0)
        expect(await otherOFT.balanceOf(bob.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseUnits("4", 18)
        await nativeOFT.connect(bob).deposit({ value: depositAmount })

        let transFee_1 = bobBalance.sub(await ethers.provider.getBalance(bob.address)).sub(depositAmount)

        expect(await nativeOFT.balanceOf(bob.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseUnits("0", 18)
        let sentFee = ethers.utils.parseUnits("2", 18)
        let totalAmount = ethers.utils.parseUnits("4", 18)

        let messageFee = ethers.utils.parseUnits("1", 18) // conversion to units of wei

        // estimate nativeFees
        const bobAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [bob.address])
        let nativeFee = (await nativeOFT.estimateSendFee(otherChainId, bobAddressBytes32, totalAmount, false, "0x")).nativeFee

        await nativeOFT.connect(bob).sendFrom(
            bob.address,
            otherChainId, // destination chainId
            bobAddressBytes32, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            [bob.address, ethers.constants.AddressZero, "0x"], // callParams: refund to bob
            { value: nativeFee.add(totalAmount.sub(depositAmount)) } // pass a msg.value to pay the LayerZero message fee
        )

        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(totalAmount)
        expect(await ethers.provider.getBalance(lzEndpointBase.address)).to.be.equal(nativeFee)
        expect(await ethers.provider.getBalance(lzEndpointOther.address)).to.be.equal(ethers.utils.parseUnits("0", 18))
        expect(await nativeOFT.balanceOf(nativeOFT.address)).to.be.equal(totalAmount)
        expect(await nativeOFT.balanceOf(bob.address)).to.be.equal(leftOverAmount)
        expect(await otherOFT.balanceOf(bob.address)).to.be.equal(totalAmount)
    })

    it("sendFrom() - from != sender with enough native", async function () {
        await nativeOFT.setUseCustomAdapterParams(false)
        await otherOFT.setUseCustomAdapterParams(false)

        // ensure they're both allocated initial amounts
        expect(await nativeOFT.balanceOf(bob.address)).to.equal(0)
        expect(await otherOFT.balanceOf(bob.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseUnits("4", 18)
        await nativeOFT.connect(bob).deposit({ value: depositAmount })

        expect(await nativeOFT.balanceOf(bob.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseUnits("0", 18)
        let totalAmount = ethers.utils.parseUnits("4", 18)

        // approve the other user to send the tokens
        await nativeOFT.connect(bob).approve(alice.address, totalAmount)

        // estimate nativeFees
        const bobAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [bob.address])
        let nativeFee = (await nativeOFT.estimateSendFee(otherChainId, bobAddressBytes32, totalAmount, false, "0x")).nativeFee

        await nativeOFT.connect(alice).sendFrom(
            bob.address,
            otherChainId, // destination chainId
            bobAddressBytes32, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            [bob.address, ethers.constants.AddressZero, "0x"], // callParams: refund to bob
            { value: nativeFee.add(totalAmount.sub(depositAmount)) } // pass a msg.value to pay the LayerZero message fee
        )

        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(totalAmount)
        expect(await ethers.provider.getBalance(lzEndpointBase.address)).to.be.equal(nativeFee)
        expect(await ethers.provider.getBalance(lzEndpointOther.address)).to.be.equal(ethers.utils.parseUnits("0", 18))
        expect(await nativeOFT.balanceOf(nativeOFT.address)).to.be.equal(totalAmount)
        expect(await nativeOFT.balanceOf(bob.address)).to.be.equal(leftOverAmount)
        expect(await otherOFT.balanceOf(bob.address)).to.be.equal(totalAmount)
    })

    it("sendFrom() - from != sender with addition msg.value", async function () {
        await nativeOFT.setUseCustomAdapterParams(false)
        await otherOFT.setUseCustomAdapterParams(false)

        // ensure they're both allocated initial amounts
        expect(await nativeOFT.balanceOf(bob.address)).to.equal(0)
        expect(await otherOFT.balanceOf(bob.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseUnits("3", 18)
        await nativeOFT.connect(bob).deposit({ value: depositAmount })

        expect(await nativeOFT.balanceOf(bob.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseUnits("0", 18)
        let sentFee = ethers.utils.parseUnits("2", 18)
        let totalAmount = ethers.utils.parseUnits("4", 18)

        // approve the other user to send the tokens
        await nativeOFT.connect(bob).approve(alice.address, totalAmount)

        // estimate nativeFees
        const bobAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [bob.address])
        let nativeFee = (await nativeOFT.estimateSendFee(otherChainId, bobAddressBytes32, totalAmount, false, "0x")).nativeFee

        await nativeOFT.connect(alice).sendFrom(
            bob.address,
            otherChainId, // destination chainId
            bobAddressBytes32, // destination address to send tokens to
            totalAmount, // quantity of tokens to send (in units of wei)
            [bob.address, ethers.constants.AddressZero, "0x"], // callParams: refund to bob
            { value: nativeFee.add(totalAmount.sub(depositAmount)) } // pass a msg.value to pay the LayerZero message fee
        )

        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(totalAmount)
        expect(await ethers.provider.getBalance(lzEndpointBase.address)).to.be.equal(nativeFee)
        expect(await ethers.provider.getBalance(lzEndpointOther.address)).to.be.equal(ethers.utils.parseUnits("0", 18))
        expect(await nativeOFT.balanceOf(nativeOFT.address)).to.be.equal(totalAmount)
        expect(await nativeOFT.balanceOf(bob.address)).to.be.equal(leftOverAmount)
        expect(await otherOFT.balanceOf(bob.address)).to.be.equal(totalAmount)
    })

    it("sendFrom() - from != sender with not enough native", async function () {
        // ensure they're both allocated initial amounts
        let bobBalance = await ethers.provider.getBalance(bob.address)
        let aliceBalance = await ethers.provider.getBalance(alice.address)
        expect(await nativeOFT.balanceOf(bob.address)).to.equal(0)
        expect(await otherOFT.balanceOf(bob.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseUnits("4", 18)
        await nativeOFT.connect(bob).deposit({ value: depositAmount })

        let transFee_1 = bobBalance.sub(await ethers.provider.getBalance(bob.address)).sub(depositAmount)

        expect(await nativeOFT.balanceOf(bob.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseUnits("0", 18)
        let sentFee = ethers.utils.parseUnits("2", 18)
        let totalAmount = ethers.utils.parseUnits("5", 18)

        // approve the other user to send the tokens
        await nativeOFT.connect(bob).approve(alice.address, totalAmount)

        let messageFee = ethers.utils.parseUnits("0.5", 18) // conversion to units of wei
        await nativeOFT.setUseCustomAdapterParams(false)
        await otherOFT.setUseCustomAdapterParams(false)


        const bobAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [bob.address])
        await expect(
            nativeOFT.connect(alice).sendFrom(
                bob.address,
                otherChainId, // destination chainId
                bobAddressBytes32, // destination address to send tokens to
                totalAmount, // quantity of tokens to send (in units of wei)
                [bob.address, ethers.constants.AddressZero, "0x"], // callParams: refund to bob
                { value: messageFee } // pass a msg.value to pay the LayerZero message fee
            )
        ).to.be.revertedWith("NativeOFTV2: Insufficient msg.value")
    })

    it("sendFrom() - from != sender not approved expect revert", async function () {
        // ensure they're both allocated initial amounts
        let bobBalance = await ethers.provider.getBalance(bob.address)
        let aliceBalance = await ethers.provider.getBalance(alice.address)
        expect(await nativeOFT.balanceOf(bob.address)).to.equal(0)
        expect(await otherOFT.balanceOf(bob.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseUnits("4", 18)
        await nativeOFT.connect(bob).deposit({ value: depositAmount })

        let transFee_1 = bobBalance.sub(await ethers.provider.getBalance(bob.address)).sub(depositAmount)

        expect(await nativeOFT.balanceOf(bob.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseUnits("0", 18)
        let sentFee = ethers.utils.parseUnits("2", 18)
        let totalAmount = ethers.utils.parseUnits("4", 18)

        // approve the other user to send the tokens
        // await nativeOFT.approve(alice.address, totalAmount)

        let messageFee = ethers.utils.parseUnits("1", 18) // conversion to units of wei
        await nativeOFT.setUseCustomAdapterParams(false)
        await otherOFT.setUseCustomAdapterParams(false)
        const bobAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [bob.address])
        await expect(
            nativeOFT.connect(alice).sendFrom(
                bob.address,
                otherChainId, // destination chainId
                bobAddressBytes32, // destination address to send tokens to
                totalAmount, // quantity of tokens to send (in units of wei)
                [bob.address, ethers.constants.AddressZero, "0x"], // callParams: refund to bob
                { value: messageFee } // pass a msg.value to pay the LayerZero message fee
            )
        ).to.be.revertedWith("ERC20: insufficient allowance")
    })

    it("sendFrom() - with insufficient value and expect revert", async function () {
        // ensure they're both allocated initial amounts
        let bobBalance = await ethers.provider.getBalance(bob.address)
        let aliceBalance = await ethers.provider.getBalance(alice.address)
        expect(await nativeOFT.balanceOf(bob.address)).to.equal(0)
        expect(await otherOFT.balanceOf(bob.address)).to.equal(0)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(0)

        let depositAmount = ethers.utils.parseUnits("4", 18)
        await nativeOFT.connect(bob).deposit({ value: depositAmount })

        let transFee_1 = bobBalance.sub(await ethers.provider.getBalance(bob.address)).sub(depositAmount)

        expect(await nativeOFT.balanceOf(bob.address)).to.equal(depositAmount)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.be.equal(depositAmount)

        let leftOverAmount = ethers.utils.parseUnits("0", 18)
        let sentFee = ethers.utils.parseUnits("2", 18)
        let totalAmount = ethers.utils.parseUnits("8", 18)

        let messageFee = ethers.utils.parseUnits("3", 18) // conversion to units of wei
        await nativeOFT.setUseCustomAdapterParams(false)
        await otherOFT.setUseCustomAdapterParams(false)
        const bobAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [bob.address])
        await expect(
            nativeOFT.connect(alice).sendFrom(
                bob.address,
                otherChainId, // destination chainId
                bobAddressBytes32, // destination address to send tokens to
                totalAmount, // quantity of tokens to send (in units of wei)
                [bob.address, ethers.constants.AddressZero, "0x"], // callParams: refund to bob
                { value: messageFee } // pass a msg.value to pay the LayerZero message fee
            )
        ).to.be.revertedWith("NativeOFTV2: Insufficient msg.value")
    })

    it("sendFrom() - tokens from main to other chain using adapterParam", async function () {
        // ensure they're both allocated initial amounts
        expect(await nativeOFT.balanceOf(bob.address)).to.equal(0)
        expect(await otherOFT.balanceOf(bob.address)).to.equal(0)

        const amount = ethers.utils.parseUnits("100", 18)
        const messageFee = ethers.utils.parseEther("101") // conversion to units of wei
        await nativeOFT.setMinDstGas(otherChainId, parseInt(await nativeOFT.PT_SEND()), 225000)
        const adapterParam = ethers.utils.solidityPack(["uint16", "uint256"], [1, 225000])

        const bobAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [bob.address])
        await nativeOFT.connect(bob).sendFrom(
            bob.address,
            otherChainId, // destination chainId
            bobAddressBytes32, // destination address to send tokens to
            amount, // quantity of tokens to send (in units of wei)
            [bob.address, ethers.constants.AddressZero, adapterParam], // callParams: refund to bob, adapterParameters empty bytes specifies default settings
            { value: messageFee } // pass a msg.value to pay the LayerZero message fee
        )

        // verify tokens burned on source chain and minted on destination chain
        expect(await nativeOFT.balanceOf(nativeOFT.address)).to.be.equal(amount)
        expect(await otherOFT.balanceOf(bob.address)).to.be.equal(amount)
    })

    it("setMinDstGas() - when type is not set on destination chain", async function () {
        const amount = ethers.utils.parseUnits("100", 18)
        const messageFee = ethers.utils.parseEther("101") // conversion to units of wei
        const adapterParam = ethers.utils.solidityPack(["uint16", "uint256"], [1, 225000])
        const bobAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [bob.address])
        await expect(
            nativeOFT.connect(bob).sendFrom(
                bob.address,
                otherChainId, // destination chainId
                bobAddressBytes32, // destination address to send tokens to
                amount, // quantity of tokens to send (in units of wei)
                [bob.address, ethers.constants.AddressZero, adapterParam], // callParams: refund to bob, adapterParameters empty bytes specifies default settings
                { value: messageFee } // pass a msg.value to pay the LayerZero message fee
            )
        ).to.be.revertedWith("LzApp: minGasLimit not set")
    })

    it("setMinDstGas() - set min dst gas higher than what we are sending and expect revert", async function () {
        const amount = ethers.utils.parseUnits("100", 18)
        const messageFee = ethers.utils.parseEther("101") // conversion to units of wei
        await nativeOFT.setMinDstGas(otherChainId, parseInt(await nativeOFT.PT_SEND()), 250000)
        const adapterParam = ethers.utils.solidityPack(["uint16", "uint256"], [1, 225000])
        const bobAddressBytes32 = ethers.utils.defaultAbiCoder.encode(["address"], [bob.address])
        await expect(
            nativeOFT.connect(bob).sendFrom(
                bob.address,
                otherChainId, // destination chainId
                bobAddressBytes32, // destination address to send tokens to
                amount, // quantity of tokens to send (in units of wei)
                [bob.address, ethers.constants.AddressZero, adapterParam], // callParams: refund to bob, adapterParameters empty bytes specifies default settings
                { value: messageFee } // pass a msg.value to pay the LayerZero message fee
            )
        ).to.be.revertedWith("LzApp: gas limit is too low")
    })

    it("wrap() and unwrap()", async function () {
        let bobBalance = await ethers.provider.getBalance(bob.address)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.equal(0)
        expect(await nativeOFT.balanceOf(bob.address)).to.equal(0)

        const amount = ethers.utils.parseUnits("100", 18)
        await nativeOFT.connect(bob).deposit({ value: amount })

        let transFee = bobBalance.sub(await ethers.provider.getBalance(bob.address)).sub(amount)

        expect(await ethers.provider.getBalance(nativeOFT.address)).to.equal(amount)
        expect(await ethers.provider.getBalance(bob.address)).to.equal(bobBalance.sub(amount).sub(transFee))
        expect(await nativeOFT.balanceOf(bob.address)).to.equal(amount)

        await nativeOFT.connect(bob).withdraw(amount)
        transFee = bobBalance.sub(await ethers.provider.getBalance(bob.address))

        expect(await ethers.provider.getBalance(nativeOFT.address)).to.equal(0)
        expect(await ethers.provider.getBalance(bob.address)).to.equal(bobBalance.sub(transFee))
        expect(await nativeOFT.balanceOf(bob.address)).to.equal(0)
    })

    it("wrap() and unwrap() expect revert", async function () {
        let bobBalance = await ethers.provider.getBalance(bob.address)
        expect(await ethers.provider.getBalance(nativeOFT.address)).to.equal(0)
        expect(await nativeOFT.balanceOf(bob.address)).to.equal(0)

        let amount = ethers.utils.parseUnits("100", 18)
        await nativeOFT.connect(bob).deposit({ value: amount })

        let transFee = bobBalance.sub(await ethers.provider.getBalance(bob.address)).sub(amount)

        expect(await ethers.provider.getBalance(nativeOFT.address)).to.equal(amount)
        expect(await ethers.provider.getBalance(bob.address)).to.equal(bobBalance.sub(amount).sub(transFee))
        expect(await nativeOFT.balanceOf(bob.address)).to.equal(amount)

        amount = ethers.utils.parseUnits("150", 18)
        await expect(nativeOFT.connect(bob).withdraw(amount)).to.be.revertedWith("NativeOFTV2: Insufficient balance.")
    })
})
