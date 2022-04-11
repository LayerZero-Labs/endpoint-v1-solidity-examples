const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("BasedOFT", function () {
    let baseChainId = 1
    let otherChainId = 2

    let name = "BasedOFT"
    let symbol = "OFT"
    let intialSupplyBaseChain = ethers.utils.parseUnits("1000000", 18)
    let accounts, owner

    beforeEach(async function () {
        accounts = await ethers.getSigners()
        owner = accounts[0]

        const LZEndpointMock = await ethers.getContractFactory("LZEndpointMock")
        const BasedOFT = await ethers.getContractFactory("BasedOFT")

        this.lzEndpointBase = await LZEndpointMock.deploy(baseChainId)
        this.lzEndpointOther = await LZEndpointMock.deploy(otherChainId)
        expect(await this.lzEndpointBase.getChainId()).to.equal(baseChainId)
        expect(await this.lzEndpointOther.getChainId()).to.equal(otherChainId)

        //------  deploy: base & other chain  -------------------------------------------------------
        // create two BasedOFT instances. both tokens have the same name and symbol on each chain
        // 1. base chain
        // 2. other chain
        this.baseOFT = await BasedOFT.deploy(name, symbol, this.lzEndpointBase.address, intialSupplyBaseChain, baseChainId)
        this.otherOFT = await BasedOFT.deploy(name, symbol, this.lzEndpointOther.address, intialSupplyBaseChain, baseChainId)

        // internal bookkeepping for endpoints (not part of a real deploy, just for this test)
        this.lzEndpointBase.setDestLzEndpoint(this.otherOFT.address, this.lzEndpointOther.address)
        this.lzEndpointOther.setDestLzEndpoint(this.baseOFT.address, this.lzEndpointBase.address)

        //------  setTrustedRemote(s) -------------------------------------------------------
        // for each OFT, setTrustedRemote to allow it to receive from the remote OFT contract.
        // Note: This is sometimes referred to as the "wire-up" process.
        await this.baseOFT.setTrustedRemote(otherChainId, this.otherOFT.address)
        await this.otherOFT.setTrustedRemote(baseChainId, this.baseOFT.address)

        // ... the deployed OFTs are ready now!
    })

    it("send() tokens from main to other chain", async function () {
        // ensure they're both starting from 1000000
        let a = await this.baseOFT.balanceOf(owner.address)
        let b = await this.otherOFT.balanceOf(owner.address)
        expect(a).to.equal(intialSupplyBaseChain)
        expect(b).to.equal(0)

        let amount = ethers.utils.parseUnits("100", 18)
        let messageFee = ethers.utils.parseEther("0.01") // conversion to units of wei
        // await this.baseOFT.approve(this.OmnichainFungibleTokenSrc.address, sendQty)
        await this.baseOFT.send(
            otherChainId, // destination chainId
            owner.address, // destination address to send tokens to
            amount, // quantity of tokens to send (in units of wei)
            owner.address, // LayerZero refund address (if too much fee is sent gets refunded)
            ethers.constants.AddressZero, // future parameter
            "0x", // adapterParameters empty bytes specifies default settings
            { value: messageFee } // pass a msg.value to pay the LayerZero message fee
        )

        // verify tokens burned on source chain and minted on destination chain
        a = await this.baseOFT.balanceOf(owner.address)
        b = await this.otherOFT.balanceOf(owner.address)
        expect(a).to.be.equal(intialSupplyBaseChain.sub(amount))
        expect(b).to.be.equal(amount)
    })
})
