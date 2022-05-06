const { expect } = require("chai")
const { ethers } = require("hardhat")

describe.only("ProxyOFT: ", function () {
    const chainId_A = 1
    const chainId_B = 2
    const chainId_C = 3
    const name = "OmnichainNonFungibleToken"
    const symbol = "ONFT"

    let owner, warlock, lzEndpointMockA, lzEndpointMockB, lzEndpointMockC
    let OFT_B, OFT_C, LZEndpointMock, ONFT, ERC20, ERC20Src, ProxyOFT_A, ProxyOFT

    before(async function () {
        owner = (await ethers.getSigners())[0]
        warlock = (await ethers.getSigners())[1]

        LZEndpointMock = await ethers.getContractFactory("LZEndpointMock")
        OFT = await ethers.getContractFactory("OFT")
        ProxyOFT = await ethers.getContractFactory("ProxyOFT")
        ERC20 = await ethers.getContractFactory("ERC20Mock")
    })

    beforeEach(async function () {
        lzEndpointMockA = await LZEndpointMock.deploy(chainId_A)
        lzEndpointMockB = await LZEndpointMock.deploy(chainId_B)
        lzEndpointMockC = await LZEndpointMock.deploy(chainId_C)

        // make an ERC20 to mock a previous deploy
        ERC20Src = await ERC20.deploy("ERC20", "ERC20")
        // generate a proxy to allow it to go OFT
        ProxyOFT_A = await ProxyOFT.deploy(lzEndpointMockA.address, ERC20Src.address)

        // create OFT on dstChains
        OFT_B = await OFT.deploy(name, symbol, lzEndpointMockB.address)
        OFT_C = await OFT.deploy(name, symbol, lzEndpointMockC.address)

        // wire the lz endpoints to guide msgs back and forth
        lzEndpointMockA.setDestLzEndpoint(OFT_B.address, lzEndpointMockB.address)
        lzEndpointMockA.setDestLzEndpoint(OFT_C.address, lzEndpointMockC.address)
        lzEndpointMockB.setDestLzEndpoint(ProxyOFT_A.address, lzEndpointMockA.address)
        lzEndpointMockB.setDestLzEndpoint(OFT_C.address, lzEndpointMockC.address)
        lzEndpointMockC.setDestLzEndpoint(ProxyOFT_A.address, lzEndpointMockA.address)
        lzEndpointMockC.setDestLzEndpoint(OFT_B.address, lzEndpointMockB.address)

        // set each contracts source address so it can send to each other
        await ProxyOFT_A.setTrustedRemote(chainId_B, OFT_B.address)
        await ProxyOFT_A.setTrustedRemote(chainId_C, OFT_C.address)
        await OFT_B.setTrustedRemote(chainId_A, ProxyOFT_A.address)
        await OFT_B.setTrustedRemote(chainId_C, OFT_C.address)
        await OFT_C.setTrustedRemote(chainId_A, ProxyOFT_A.address)
        await OFT_C.setTrustedRemote(chainId_B, OFT_B.address)
    })

    it("sendFrom() - your own tokens", async function () {
        const tokenId = 123
        await ERC20Src.mint(owner.address, tokenId)

        // verify the owner of the token is on the source chain
        expect(await ERC20Src.ownerOf(tokenId)).to.be.equal(owner.address)

        // token doesn't exist on other chain
        await expect(OFT_B.ownerOf(tokenId)).to.be.revertedWith("ERC20: operator query for nonexistent token")

        // can transfer token on srcChain as regular erC721
        await ERC20Src.transfer(warlock.address, tokenId)
        expect(await ERC20Src.ownerOf(tokenId)).to.be.equal(warlock.address)

        // approve the proxy to swap your token
        await ERC20Src.connect(warlock).approve(ProxyOFT_A.address, tokenId)

        // swaps token to other chain
        await ProxyOFT_A.connect(warlock).sendFrom(warlock.address, chainId_B, warlock.address, tokenId, warlock.address, ethers.constants.AddressZero, "0x")

        // token is now owned by the proxy contract, because this is the original nft chain
        expect(await ERC20Src.ownerOf(tokenId)).to.equal(ProxyOFT_A.address)

        // token received on the dst chain
        expect(await OFT_B.ownerOf(tokenId)).to.be.equal(warlock.address)

        // can send to other onft contract eg. not the original nft contract chain
        await OFT_B.connect(warlock).sendFrom(warlock.address, chainId_C, warlock.address, tokenId, warlock.address, ethers.constants.AddressZero, "0x")

        // token is burned on the sending chain
        await expect(OFT_B.ownerOf(tokenId)).to.be.revertedWith("ERC20: operator query for nonexistent token")

        // token received on the dst chain
        expect(await OFT_C.ownerOf(tokenId)).to.be.equal(warlock.address)

        // send it back to the original chain
        await OFT_C.connect(warlock).sendFrom(warlock.address, chainId_A, warlock.address, tokenId, warlock.address, ethers.constants.AddressZero, "0x")

        // token is burned on the sending chain
        await expect(OFT_C.ownerOf(tokenId)).to.be.revertedWith("ERC20: operator query for nonexistent token")

        // is received on the original chain
        expect(await ERC20Src.ownerOf(tokenId)).to.be.equal(warlock.address)
    })

    it("sendFrom() - reverts if not approved on proxy", async function () {
        const tokenId = 123
        await ERC20Src.mint(owner.address, tokenId)
        await expect(ProxyOFT_A.sendFrom(owner.address, chainId_B, owner.address, tokenId, owner.address, ethers.constants.AddressZero, "0x")).to.be.revertedWith("ERC20: transfer caller is not owner nor approved")
    })

    it("sendFrom() - reverts if from is not msgSender", async function () {
        const tokenId = 123
        await ERC20Src.mint(owner.address, tokenId)

        // approve the proxy to swap your token
        await ERC20Src.approve(ProxyOFT_A.address, tokenId)

        // swaps token to other chain
        await expect(ProxyOFT_A.connect(warlock).sendFrom(owner.address, chainId_B, owner.address, tokenId, owner.address, ethers.constants.AddressZero, "0x")).to.be.revertedWith("ProxyOFT721: owner is not send caller")
    })

    it("sendFrom() - reverts if not owner on non proxy chain", async function () {
        const tokenId = 123
        await ERC20Src.mint(owner.address, tokenId)

        // approve the proxy to swap your token
        await ERC20Src.approve(ProxyOFT_A.address, tokenId)

        // swaps token to other chain
        await ProxyOFT_A.sendFrom(owner.address, chainId_B, owner.address, tokenId, owner.address, ethers.constants.AddressZero, "0x")

        // token received on the dst chain
        expect(await OFT_B.ownerOf(tokenId)).to.be.equal(owner.address)

        // reverts because other address does not own it
        await expect(OFT_B.connect(warlock).sendFrom(warlock.address, chainId_C, warlock.address, tokenId, warlock.address, ethers.constants.AddressZero, "0x")).to.be.revertedWith("OFT721: send caller is not owner nor approved")
    })

    it("sendFrom() - on behalf of other user", async function () {
        const tokenId = 123
        await ERC20Src.mint(owner.address, tokenId)

        // approve the proxy to swap your token
        await ERC20Src.approve(ProxyOFT_A.address, tokenId)

        // swaps token to other chain
        await ProxyOFT_A.sendFrom(owner.address, chainId_B, owner.address, tokenId, owner.address, ethers.constants.AddressZero, "0x")

        // token received on the dst chain
        expect(await OFT_B.ownerOf(tokenId)).to.be.equal(owner.address)

        // approve the other user to send the token
        await OFT_B.approve(warlock.address, tokenId)

        // sends across
        await OFT_B.connect(warlock).sendFrom(owner.address, chainId_C, warlock.address, tokenId, warlock.address, ethers.constants.AddressZero, "0x")

        // token received on the dst chain
        expect(await OFT_C.ownerOf(tokenId)).to.be.equal(warlock.address)
    })

    it("sendFrom() - reverts if contract is approved, but not the sending user", async function () {
        const tokenId = 123
        await ERC20Src.mint(owner.address, tokenId)

        // approve the proxy to swap your token
        await ERC20Src.approve(ProxyOFT_A.address, tokenId)

        // swaps token to other chain
        await ProxyOFT_A.sendFrom(owner.address, chainId_B, owner.address, tokenId, owner.address, ethers.constants.AddressZero, "0x")

        // token received on the dst chain
        expect(await OFT_B.ownerOf(tokenId)).to.be.equal(owner.address)

        // approve the proxy to swap your token
        await OFT_B.approve(OFT_B.address, tokenId)

        // reverts because proxy is approved, not the user
        await expect(OFT_B.connect(warlock).sendFrom(owner.address, chainId_C, warlock.address, tokenId, warlock.address, ethers.constants.AddressZero, "0x")).to.be.revertedWith("OFT721: send caller is not owner nor approved")
    })

    it("sendFrom() - reverts if not approved on non proxy chain", async function () {
        const tokenId = 123
        await ERC20Src.mint(owner.address, tokenId)

        // approve the proxy to swap your token
        await ERC20Src.approve(ProxyOFT_A.address, tokenId)

        // swaps token to other chain
        await ProxyOFT_A.sendFrom(owner.address, chainId_B, owner.address, tokenId, owner.address, ethers.constants.AddressZero, "0x")

        // token received on the dst chain
        expect(await OFT_B.ownerOf(tokenId)).to.be.equal(owner.address)

        // reverts because not approved
        await expect(OFT_B.connect(warlock).sendFrom(owner.address, chainId_C, warlock.address, tokenId, warlock.address, ethers.constants.AddressZero, "0x")).to.be.revertedWith("OFT721: send caller is not owner nor approved")
    })

    it("sendFrom() - reverts if someone else is approved, but not the sender", async function () {
        const tokenIdA = 123
        const tokenIdB = 456
        // mint to both owners
        await ERC20Src.mint(owner.address, tokenIdA)
        await ERC20Src.mint(warlock.address, tokenIdB)

        // approve owner.address to transfer, but not the other
        await ERC20Src.setApprovalForAll(ProxyOFT_A.address, true)

        await expect(ProxyOFT_A.connect(warlock).sendFrom(warlock.address, chainId_B, warlock.address, tokenIdB, warlock.address, ethers.constants.AddressZero, "0x")).to.be.revertedWith("ERC20: transfer caller is not owner nor approved")
        await expect(ProxyOFT_A.connect(warlock).sendFrom(warlock.address, chainId_B, owner.address, tokenIdB, owner.address, ethers.constants.AddressZero, "0x")).to.be.revertedWith("ERC20: transfer caller is not owner nor approved")
    })

    it("sendFrom() - reverts if sender does not own token", async function () {
        const tokenIdA = 123
        const tokenIdB = 456
        // mint to both owners
        await ERC20Src.mint(owner.address, tokenIdA)
        await ERC20Src.mint(warlock.address, tokenIdB)

        // approve owner.address to transfer, but not the other
        await ERC20Src.setApprovalForAll(ProxyOFT_A.address, true)

        await expect(ProxyOFT_A.connect(warlock).sendFrom(warlock.address, chainId_B, warlock.address, tokenIdA, warlock.address, ethers.constants.AddressZero, "0x")).to.be.revertedWith("ERC20: transfer from incorrect owner")
        await expect(ProxyOFT_A.connect(warlock).sendFrom(warlock.address, chainId_B, owner.address, tokenIdA, owner.address, ethers.constants.AddressZero, "0x")).to.be.revertedWith("ERC20: transfer from incorrect owner")
    })
})
